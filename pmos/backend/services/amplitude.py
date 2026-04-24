import base64
import json
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

import httpx


def amplitude_auth_header(api_key: str, secret_key: str) -> dict[str, str]:
    encoded = base64.b64encode(f"{api_key}:{secret_key}".encode("utf-8")).decode("utf-8")
    return {"Authorization": f"Basic {encoded}"}


async def test_amplitude_connection(api_key: str, secret_key: str) -> None:
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            "https://amplitude.com/api/2/events/list",
            headers=amplitude_auth_header(api_key, secret_key),
        )
        response.raise_for_status()


async def fetch_last_30_days_events(api_key: str, secret_key: str) -> list[dict[str, Any]]:
    now = datetime.utcnow()
    start = (now - timedelta(days=30)).strftime("%Y%m%dT00")
    end = now.strftime("%Y%m%dT23")
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(
            "https://amplitude.com/api/2/export",
            headers=amplitude_auth_header(api_key, secret_key),
            params={"start": start, "end": end},
        )
        response.raise_for_status()
        events: list[dict[str, Any]] = []
        for line in response.text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return events


def aggregate_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = defaultdict(lambda: {"count": 0, "users": set(), "days": set()})
    for event in events:
        event_name = event.get("event_type", "Unknown event")
        grouped[event_name]["count"] += 1
        if event.get("user_id"):
            grouped[event_name]["users"].add(event["user_id"])
        if event.get("event_time"):
            grouped[event_name]["days"].add(str(event["event_time"])[:10])

    aggregates: list[dict[str, Any]] = []
    for name, values in grouped.items():
        aggregates.append(
            {
                "event_name": name,
                "count": values["count"],
                "unique_users": len(values["users"]),
                "trend": "rising" if len(values["days"]) > 14 else "stable",
            }
        )
    return sorted(aggregates, key=lambda item: item["count"], reverse=True)


def events_to_chunks(events: list[dict[str, Any]]) -> list[str]:
    return [
        "\n".join(
            [
                f"Event Name: {event['event_name']}",
                f"Count (30d): {event['count']}",
                f"Unique Users: {event['unique_users']}",
                f"Trend: {event['trend']}",
            ]
        )
        for event in events
    ]
