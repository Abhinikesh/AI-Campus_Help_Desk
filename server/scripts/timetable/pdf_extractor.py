"""
pdf_extractor.py
Deterministic extraction of text, metadata, and word bounding boxes from timetable PDF.
Uses Poppler utilities (pdfinfo, pdftotext -tsv) without OCR.
"""
import hashlib
import os
import subprocess
from typing import Dict, List, Any, Optional

DEFAULT_PDF_PATH = "/Users/abhinikesh/.gemini/antigravity/brain/fa54af9b-a3ec-4155-b2de-927994afd217/.user_uploaded/media_1794370819803_238c020d.pdf"
PDFTEXT_BIN = "/opt/homebrew/bin/pdftotext"
PDFINFO_BIN = "/opt/homebrew/bin/pdfinfo"


class PDFExtractor:
    def __init__(self, pdf_path: str = DEFAULT_PDF_PATH):
        self.pdf_path = os.path.abspath(pdf_path)
        if not os.path.exists(self.pdf_path):
            raise FileNotFoundError(f"Source PDF not found at {self.pdf_path}")
        self._metadata: Optional[Dict[str, Any]] = None
        self._page_cache: Dict[int, List[Dict[str, Any]]] = {}

    def get_document_identity(self) -> Dict[str, Any]:
        """Calculates SHA-256 hash, file size, and extracts pdfinfo metadata."""
        if self._metadata is not None:
            return self._metadata

        hasher = hashlib.sha256()
        with open(self.pdf_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        sha256 = hasher.hexdigest()
        file_size = os.path.getsize(self.pdf_path)

        res = subprocess.run([PDFINFO_BIN, self.pdf_path], capture_output=True, text=True, check=True)
        info_lines = res.stdout.strip().split("\n")
        info_map = {}
        for line in info_lines:
            if ":" in line:
                k, v = line.split(":", 1)
                info_map[k.strip()] = v.strip()

        page_count = int(info_map.get("Pages", "0"))
        if page_count != 50:
            raise ValueError(f"Expected exactly 50 pages in timetable PDF, found {page_count}")

        self._metadata = {
            "path": self.pdf_path,
            "filename": os.path.basename(self.pdf_path),
            "fileSize": file_size,
            "sha256": sha256,
            "pages": page_count,
            "title": info_map.get("Title", ""),
            "author": info_map.get("Author", ""),
            "creator": info_map.get("Creator", ""),
            "producer": info_map.get("Producer", ""),
            "creationDate": info_map.get("CreationDate", ""),
        }
        return self._metadata

    def get_page_words(self, page_num: int) -> List[Dict[str, Any]]:
        """Extracts word bounding boxes for a specific 1-indexed page using pdftotext -tsv."""
        if page_num in self._page_cache:
            return self._page_cache[page_num]

        res = subprocess.run(
            [PDFTEXT_BIN, "-tsv", "-f", str(page_num), "-l", str(page_num), self.pdf_path, "-"],
            capture_output=True,
            text=True,
            check=True,
        )

        words = []
        for line in res.stdout.split("\n")[1:]:
            parts = line.split("\t")
            if len(parts) >= 12 and parts[0] == "5":  # Level 5 = Word
                words.append({
                    "left": float(parts[6]),
                    "top": float(parts[7]),
                    "width": float(parts[8]),
                    "height": float(parts[9]),
                    "confidence": float(parts[10]),
                    "text": parts[11].strip(),
                })

        self._page_cache[page_num] = words
        return words


PDF_PATH = DEFAULT_PDF_PATH


def get_pdf_metadata(pdf_path: str = DEFAULT_PDF_PATH) -> Dict[str, Any]:
    return PDFExtractor(pdf_path).get_document_identity()


def extract_words_from_pdf(pdf_path: str = DEFAULT_PDF_PATH) -> Dict[int, List[Dict[str, Any]]]:
    extractor = PDFExtractor(pdf_path)
    return {p: extractor.get_page_words(p) for p in range(1, 51)}


if __name__ == "__main__":
    extractor = PDFExtractor()
    meta = extractor.get_document_identity()
    print("PDF Metadata:", meta)
    words = extractor.get_page_words(1)
    print(f"Page 1 words extracted: {len(words)}")
