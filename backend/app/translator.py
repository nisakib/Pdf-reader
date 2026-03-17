import logging
import time
from typing import Optional
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from .config import settings

logger = logging.getLogger(__name__)

MAX_CHUNK_CHARS = 3000


def translate_text(japanese_text: str) -> str:
    """Translate Japanese text to English using the configured provider."""
    if not japanese_text.strip():
        return ""

    if settings.translation_provider == "openai" and settings.openai_api_key:
        return _translate_openai(japanese_text)
    else:
        logger.warning("No translation provider configured; returning placeholder.")
        return f"[Translation unavailable – set OPENAI_API_KEY] Original: {japanese_text[:200]}"


def _chunk_text(text: str, max_chars: int = MAX_CHUNK_CHARS) -> list[str]:
    """Split text into chunks at sentence boundaries when possible."""
    if len(text) <= max_chars:
        return [text]

    chunks = []
    current = ""
    for line in text.split("\n"):
        if len(current) + len(line) + 1 > max_chars:
            if current:
                chunks.append(current.strip())
                current = ""
        current += line + "\n"
    if current.strip():
        chunks.append(current.strip())
    return chunks if chunks else [text]


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
def _translate_openai(text: str) -> str:
    """Translate using OpenAI Chat API with chunking and retry."""
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    chunks = _chunk_text(text)
    translated_chunks = []

    for chunk in chunks:
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a professional translator. "
                        "Translate the following Japanese text to English. "
                        "Preserve the original paragraph structure. "
                        "Output only the translated text, nothing else."
                    ),
                },
                {"role": "user", "content": chunk},
            ],
            temperature=0.2,
        )
        translated_chunks.append(response.choices[0].message.content.strip())

    return "\n\n".join(translated_chunks)
