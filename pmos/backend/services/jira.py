import base64
from typing import Any

import httpx


def jira_auth_header(email: str, api_token: str) -> dict[str, str]:
    encoded = base64.b64encode(f"{email}:{api_token}".encode("utf-8")).decode("utf-8")
    return {"Authorization": f"Basic {encoded}", "Accept": "application/json"}


async def test_jira_connection(jira_url: str, email: str, api_token: str) -> None:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            f"{jira_url.rstrip('/')}/rest/api/3/myself",
            headers=jira_auth_header(email, api_token),
        )
        response.raise_for_status()


async def fetch_recent_issues(jira_url: str, email: str, api_token: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{jira_url.rstrip('/')}/rest/api/3/search",
            headers={**jira_auth_header(email, api_token), "Content-Type": "application/json"},
            json={
                "jql": "updated >= -90d AND issuetype in (Bug, Story) ORDER BY updated DESC",
                "fields": ["summary", "description", "comment", "labels", "status"],
                "maxResults": 100,
            },
        )
        response.raise_for_status()
        return response.json().get("issues", [])


def issue_to_chunk(issue: dict[str, Any]) -> str:
    fields = issue.get("fields", {})
    comments = fields.get("comment", {}).get("comments", [])
    comment_lines = [
        item.get("body", {}).get("content", [])
        if isinstance(item.get("body"), dict)
        else item.get("body")
        for item in comments[:5]
    ]
    return "\n".join(
        [
            f"Issue Key: {issue.get('key')}",
            f"Summary: {fields.get('summary', '')}",
            f"Status: {fields.get('status', {}).get('name', '')}",
            f"Labels: {', '.join(fields.get('labels', []))}",
            f"Description: {fields.get('description', '')}",
            f"Comments: {comment_lines}",
        ]
    )


def task_to_adf_description(task: dict[str, Any]) -> dict[str, Any]:
    body_lines = [
        task.get("context", ""),
        "",
        "Acceptance Criteria:",
        *[f"- {criterion}" for criterion in task.get("acceptance_criteria", [])],
        "",
        f"Constraints: {task.get('constraints', '')}",
    ]
    return {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": line or " "}],
            }
            for line in body_lines
        ],
    }


async def create_jira_issue(
    jira_url: str,
    email: str,
    api_token: str,
    project_key: str,
    task: dict[str, Any],
) -> dict[str, Any]:
    issue_type = "Story" if task.get("type") in {"frontend", "backend"} else "Task"
    payload = {
        "fields": {
            "project": {"key": project_key},
            "summary": task["title"],
            "description": task_to_adf_description(task),
            "issuetype": {"name": issue_type},
            "labels": [task.get("type", "task"), "pmos-generated"],
        }
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{jira_url.rstrip('/')}/rest/api/3/issue",
            headers={**jira_auth_header(email, api_token), "Content-Type": "application/json"},
            json=payload,
        )
        response.raise_for_status()
        return response.json()
