import os
import json
import logging
from celery import Celery
from .config import settings
from .pdf_processor import extract_pages
from .translator import translate_text
from .output_gen import generate_docx, generate_pdf

logger = logging.getLogger(__name__)

celery_app = Celery("pdf_translator", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=3600 * 24,  # 24h
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)


def _job_dir(job_id: str) -> str:
    return os.path.join(settings.data_dir, job_id)


def _save_state(job_id: str, state: dict) -> None:
    path = os.path.join(_job_dir(job_id), "state.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def _load_state(job_id: str) -> dict:
    path = os.path.join(_job_dir(job_id), "state.json")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@celery_app.task(bind=True, name="process_pdf")
def process_pdf(self, job_id: str, pdf_path: str) -> None:
    """Main Celery task: extract → translate → generate outputs."""
    job_dir = _job_dir(job_id)
    os.makedirs(job_dir, exist_ok=True)

    def update(status: str, progress: int, message: str = "", **extra):
        state = {
            "job_id": job_id,
            "status": status,
            "progress": progress,
            "message": message,
            **extra,
        }
        _save_state(job_id, state)

    try:
        update("processing", 5, "Extracting text from PDF…")
        raw_pages = extract_pages(pdf_path)
        total = len(raw_pages)
        update("processing", 15, f"Extracted {total} pages. Translating…", total_pages=total, current_page=0)

        translated_pages = []
        for i, raw in enumerate(raw_pages):
            page_num = raw["page_number"]
            update(
                "processing",
                15 + int(70 * i / total),
                f"Translating page {page_num}/{total}…",
                total_pages=total,
                current_page=page_num,
            )
            english = translate_text(raw["text"])
            translated_pages.append({
                "page_number": page_num,
                "japanese_text": raw["text"],
                "english_text": english,
                "ocr_used": raw["ocr_used"],
            })

        update("processing", 85, "Generating DOCX…", total_pages=total, current_page=total)
        docx_path = os.path.join(job_dir, "translation.docx")
        generate_docx(translated_pages, docx_path)

        update("processing", 92, "Generating PDF…", total_pages=total, current_page=total)
        out_pdf_path = os.path.join(job_dir, "translation.pdf")
        generate_pdf(translated_pages, out_pdf_path)

        # Save full results
        results_path = os.path.join(job_dir, "results.json")
        with open(results_path, "w", encoding="utf-8") as f:
            json.dump(translated_pages, f, ensure_ascii=False, indent=2)

        update("completed", 100, "Done!", total_pages=total, current_page=total)
        logger.info(f"Job {job_id} completed successfully.")

    except Exception as exc:
        logger.exception(f"Job {job_id} failed: {exc}")
        update("failed", 0, str(exc), error=str(exc))
        raise
