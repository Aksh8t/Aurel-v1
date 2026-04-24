HANDOFF_PROMPT = """
You are breaking down a product specification into structured task packages
for a development team using AI coding agents.

SPECIFICATION:
{spec}

Break this into individual engineering tasks. Each task must be independently
implementable. Separate frontend, backend, and data work into distinct tasks.
Never merge tasks with different risk profiles.

Return ONLY this JSON, nothing else:

{{
  "tasks": [
    {{
      "title": "Short imperative title (e.g. 'Add user_preferences table to schema')",
      "type": "frontend | backend | data_migration | integration | infra",
      "context": "2-3 sentences: why this task exists, what customer problem it serves, written for an AI coding agent with no other context",
      "acceptance_criteria": [
        "Specific, testable condition for done"
      ],
      "constraints": "Tech stack requirements, existing patterns to follow, things not to change",
      "dependencies": ["Title of task that must complete first"],
      "effort_estimate": "2h | 4h | 1d | 2d | 3d",
      "likely_files": ["path/to/likely/file.ts"],
      "test_cases": ["Scenario to verify"]
    }}
  ],
  "suggested_sprint_split": {{
    "mvp": ["Task titles for minimum shippable version"],
    "full_rollout": ["Remaining tasks for complete feature"]
  }},
  "cursor_context_summary": "2 paragraph summary of the entire feature a developer would need to paste into Cursor to begin work. Include the why, what, and key constraints."
}}
"""
