SPECIFICATION_PROMPT = """
You are writing a complete product specification for the following opportunity.

OPPORTUNITY:
{opportunity}

EVIDENCE FROM CUSTOMER SIGNALS:
{evidence}

RELATED CONTEXT FROM KNOWLEDGE BASE:
{context}

Write a complete product specification. Return ONLY this JSON, nothing else:

{{
  "title": "Feature name",
  "problem_statement": "Detailed description of the customer problem. Who has this problem, when does it occur, what do they do today as a workaround, what is the cost of the current situation. Cite specific evidence.",
  "proposed_solution": "Plain language description of the proposed feature or change as the USER would experience it. Not technical. Written from the user's perspective.",
  "success_metrics": [
    {{
      "metric": "Metric name",
      "baseline": "Current value if known",
      "target": "Target value",
      "measurement": "How to measure this"
    }}
  ],
  "user_stories": [
    {{
      "type": "primary | edge_case | error_state",
      "story": "As a [user type], I want to [action] so that [outcome]",
      "acceptance_criteria": ["criterion 1", "criterion 2"]
    }}
  ],
  "ui_changes": [
    {{
      "screen": "Name of affected screen or component",
      "change_type": "add | modify | remove",
      "description": "Specific change description",
      "rationale": "Why this change (linked to user evidence)",
      "validation_needed": "What the PM should validate with design"
    }}
  ],
  "data_model_changes": [
    {{
      "type": "new_table | new_field | modify_field | new_relationship",
      "description": "Specific change",
      "migration_notes": "Any migration considerations"
    }}
  ],
  "workflow_changes": [
    {{
      "description": "What changes in how the user moves through the product",
      "affected_integrations": ["integration name if any"]
    }}
  ],
  "out_of_scope": "Explicit list of what is NOT in this version and why",
  "open_questions": [
    {{
      "question": "Unresolved question requiring PM judgment or research",
      "why_it_matters": "Impact on the spec if answered differently"
    }}
  ]
}}
"""
