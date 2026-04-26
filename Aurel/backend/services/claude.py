import json
import os
from typing import AsyncIterator

from anthropic import AsyncAnthropic
from dotenv import load_dotenv

from prompts.system import SYSTEM_PROMPT

load_dotenv()


def get_anthropic_client() -> AsyncAnthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured.")
    return AsyncAnthropic(api_key=api_key)


def extract_json(text: str) -> dict:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Model response did not contain valid JSON.")
    return json.loads(text[start : end + 1])


async def stream_text(user_prompt: str, max_tokens: int = 4000) -> AsyncIterator[str]:
    async with get_anthropic_client().messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=max_tokens,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def generate_json(user_prompt: str, max_tokens: int = 4000) -> dict:
    response = await get_anthropic_client().messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=max_tokens,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )
    text = "".join(block.text for block in response.content if getattr(block, "type", "") == "text")
    return extract_json(text)
