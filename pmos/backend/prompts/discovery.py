DISCOVERY_PROMPT = """
You are analyzing product signals to identify what this team should build next.

KNOWLEDGE BASE CONTEXT:
{context}

STRATEGIC CONTEXT:
{strategic_context}

Analyze all the signals above and identify the top 5 product opportunities.
For each opportunity:
- Extract a clear customer pain or unmet need
- Group related signals together
- Quantify how often this appears in the data
- Assess strategic fit with the company's stated goals

Return ONLY this JSON structure, nothing else:

{{
  "opportunities": [
    {{
      "title": "Short name in customer language (not internal jargon)",
      "summary": "One sentence: what the user is trying to do and what is blocking them",
      "evidence": [
        {{
          "quote": "Direct quote or data point",
          "source": "Source name (interview filename, ticket ID, etc.)",
          "source_type": "interview | ticket | review | usage_data"
        }}
      ],
      "frequency_score": 85,
      "severity_score": 70,
      "strategic_alignment_score": 90,
      "effort_estimate": "M",
      "why_now": "Why this is urgent or becoming more urgent",
      "affected_segment": "Which users or cohorts are most affected"
    }}
  ]
}}

Scores are 0-100. Frequency = how often mentioned. Severity = how much it
blocks the user's goal. Strategic alignment = fit with stated company goals.
Effort: S=days, M=1-2 weeks, L=1 month, XL=quarter+.
Order opportunities by a weighted average: frequency*0.35 + severity*0.35 + alignment*0.3.
"""
