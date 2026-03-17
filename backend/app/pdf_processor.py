import fitz  # PyMuPDF
import pytesseract
from PIL import Image
import io
import logging

logger = logging.getLogger(__name__)

MIN_TEXT_LENGTH = 50  # chars per page to consider it "text-based"
OCR_DPI = 300
POINTS_PER_INCH = 72


def extract_pages(pdf_path: str) -> list[dict]:
    """
    Extract text from each page. If a page has insufficient text, use OCR.
    Returns list of dicts: {page_number, text, ocr_used}
    """
    doc = fitz.open(pdf_path)
    results = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text").strip()

        ocr_used = False
        if len(text) < MIN_TEXT_LENGTH:
            # Render page to image and run OCR
            logger.info(f"Page {page_num+1}: using OCR (text too short: {len(text)} chars)")
            text = _ocr_page(page)
            ocr_used = True
        else:
            logger.info(f"Page {page_num+1}: extracted {len(text)} chars via text extraction")

        results.append({
            "page_number": page_num + 1,
            "text": text,
            "ocr_used": ocr_used,
        })

    doc.close()
    return results


def _ocr_page(page) -> str:
    """Render a PDF page to image and run Tesseract OCR with Japanese language."""
    # Render at OCR_DPI for good OCR quality
    scale = OCR_DPI / POINTS_PER_INCH
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img_bytes = pix.tobytes("png")
    img = Image.open(io.BytesIO(img_bytes))

    # Try vertical Japanese first, fall back to horizontal
    custom_config = r"--oem 3 --psm 6"
    try:
        text = pytesseract.image_to_string(img, lang="jpn", config=custom_config)
    except Exception as e:
        logger.warning(f"OCR failed: {e}")
        text = ""

    return text.strip()
