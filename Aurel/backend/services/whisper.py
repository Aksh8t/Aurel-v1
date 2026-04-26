import io
import os

from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()


def get_openai_client() -> AsyncOpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")
    return AsyncOpenAI(api_key=api_key)


async def transcribe_audio(filename: str, file_bytes: bytes) -> str:
    file_obj = io.BytesIO(file_bytes)
    file_obj.name = filename
    response = await get_openai_client().audio.transcriptions.create(model="whisper-1", file=file_obj)
    return response.text
