# JP→EN PDF Translator

A web application that translates Japanese PDFs to English. Supports both **text-based PDFs** (direct text extraction) and **scanned/image PDFs** (OCR with Japanese language support).

## Features

- �� Upload Japanese PDF (up to 50 MB)
- 🔍 Auto-detects text-based vs. scanned PDFs
- 🖼️ OCR with Tesseract + Japanese language data for scanned pages
- 🌐 Translation via OpenAI API (configurable)
- 📄 Per-page viewer: original Japanese + English translation side-by-side
- 💾 Download as **DOCX** or **PDF**
- 🔄 Background processing with real-time progress updates

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (TypeScript) |
| Backend | FastAPI (Python 3.11) |
| Background Jobs | Celery + Redis |
| PDF Extraction | PyMuPDF (fitz) |
| OCR | Tesseract + `jpn` language data via pytesseract |
| Translation | OpenAI GPT-4o-mini (configurable) |
| Output generation | python-docx, ReportLab |

## Quick Start (Docker)

### Prerequisites
- Docker & Docker Compose
- An OpenAI API key (for translation)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/nisakib/Pdf-reader.git
cd Pdf-reader

# 2. Create environment file
cp .env.example .env
# Edit .env and set your OPENAI_API_KEY

# 3. Start all services
docker compose up --build

# 4. Open in browser
# Frontend: http://localhost:3000
# API docs: http://localhost:8000/docs
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | _(required for translation)_ | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model to use |
| `TRANSLATION_PROVIDER` | `openai` | Translation provider (`openai` only for now) |
| `MAX_UPLOAD_SIZE_MB` | `50` | Maximum PDF upload size in MB |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection URL |
| `DATA_DIR` | `/data` | Directory for storing uploads and job artifacts |

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Install Tesseract + Japanese language data
# macOS:   brew install tesseract tesseract-lang
# Ubuntu:  sudo apt-get install tesseract-ocr tesseract-ocr-jpn

# Start API
DATA_DIR=./data REDIS_URL=redis://localhost:6379/0 uvicorn app.main:app --reload

# Start worker (separate terminal)
DATA_DIR=./data REDIS_URL=redis://localhost:6379/0 celery -A app.tasks.celery_app worker --loglevel=info
```

### Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload PDF → returns `{job_id}` |
| `GET` | `/api/job/{job_id}` | Get job status and progress |
| `GET` | `/api/job/{job_id}/result` | Get per-page JA/EN results |
| `GET` | `/api/job/{job_id}/download/docx` | Download translated DOCX |
| `GET` | `/api/job/{job_id}/download/pdf` | Download translated PDF |

## How OCR Works

1. Each PDF page is inspected for selectable text using **PyMuPDF**.
2. If a page contains fewer than 50 characters of text (indicating a scanned/image page), it is rendered to a PNG image at 300 DPI.
3. **Tesseract OCR** processes the image using the `jpn` (Japanese) language model, which was trained on Japanese characters (hiragana, katakana, kanji).
4. The extracted text is then translated just like text-based pages.

> **Tip**: OCR quality depends on image resolution and font clarity. Printed documents generally work well; handwritten text may have lower accuracy.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Translation shows placeholder text | Set `OPENAI_API_KEY` in your `.env` file |
| OCR produces garbled text | Ensure the PDF image quality is high; try enabling `jpn_vert` for vertical Japanese text |
| Upload fails with 413 error | Reduce file size or increase `MAX_UPLOAD_SIZE_MB` |
| Worker not processing jobs | Ensure Redis is running and `REDIS_URL` is correct |
| DOCX/PDF download returns 404 | Job may still be processing; wait for status to show "completed" |

## Project Structure

```
.
├── frontend/          # Next.js TypeScript frontend
│   ├── src/app/       # App Router pages
│   └── Dockerfile
├── backend/           # FastAPI + Celery backend
│   ├── app/
│   │   ├── main.py           # API routes
│   │   ├── tasks.py          # Celery task
│   │   ├── pdf_processor.py  # PDF/OCR extraction
│   │   ├── translator.py     # Translation logic
│   │   ├── output_gen.py     # DOCX/PDF generation
│   │   ├── models.py         # Pydantic models
│   │   └── config.py         # Settings
│   └── Dockerfile
├── data/              # Job storage (uploads + artifacts)
├── docker-compose.yml
└── README.md
```
