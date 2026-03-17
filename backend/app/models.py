from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

class JobStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"

class PageResult(BaseModel):
    page_number: int
    japanese_text: str
    english_text: str
    ocr_used: bool = False

class JobResult(BaseModel):
    job_id: str
    status: JobStatus
    progress: int = 0
    total_pages: int = 0
    current_page: int = 0
    message: str = ""
    pages: Optional[List[PageResult]] = None
    error: Optional[str] = None
