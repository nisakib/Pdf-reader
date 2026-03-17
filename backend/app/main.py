import os
import uuid
import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import aiofiles

from .config import settings
from .models import JobResult, JobStatus, PageResult
from .tasks import celery_app, process_pdf, _job_dir, _load_state

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="PDF Translator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_BYTES = settings.max_upload_size_mb * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...)):
    # Validate MIME type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES and not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    # Read and size-check
    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.max_upload_size_mb} MB.",
        )

    job_id = str(uuid.uuid4())
    job_dir = _job_dir(job_id)
    os.makedirs(job_dir, exist_ok=True)

    pdf_path = os.path.join(job_dir, "input.pdf")
    async with aiofiles.open(pdf_path, "wb") as f:
        await f.write(contents)

    # Write initial state
    state = {
        "job_id": job_id,
        "status": "pending",
        "progress": 0,
        "message": "Job queued",
        "total_pages": 0,
        "current_page": 0,
    }
    state_path = os.path.join(job_dir, "state.json")
    async with aiofiles.open(state_path, "w") as f:
        await f.write(json.dumps(state))

    # Dispatch Celery task
    process_pdf.delay(job_id, pdf_path)
    logger.info(f"Uploaded PDF, created job {job_id}")

    return {"job_id": job_id}


@app.get("/api/job/{job_id}")
def get_job_status(job_id: str):
    state = _load_state(job_id)
    if not state:
        raise HTTPException(status_code=404, detail="Job not found")
    return state


@app.get("/api/job/{job_id}/result")
def get_job_result(job_id: str):
    state = _load_state(job_id)
    if not state:
        raise HTTPException(status_code=404, detail="Job not found")
    if state.get("status") != "completed":
        raise HTTPException(status_code=202, detail="Job not yet completed")

    results_path = os.path.join(_job_dir(job_id), "results.json")
    if not os.path.exists(results_path):
        raise HTTPException(status_code=404, detail="Results file not found")
    with open(results_path, encoding="utf-8") as f:
        pages = json.load(f)
    return {"job_id": job_id, "pages": pages}


@app.get("/api/job/{job_id}/download/docx")
def download_docx(job_id: str):
    path = os.path.join(_job_dir(job_id), "translation.docx")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="DOCX not ready")
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename="translation.docx",
    )


@app.get("/api/job/{job_id}/download/pdf")
def download_pdf(job_id: str):
    path = os.path.join(_job_dir(job_id), "translation.pdf")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="PDF not ready")
    return FileResponse(path, media_type="application/pdf", filename="translation.pdf")
