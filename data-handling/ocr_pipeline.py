"""
OCR Pipeline for vocabulary textbook images.

Steps:
  1. Preprocess each image (deskew, crop borders, binarize)
  2. Run Tesseract OCR (Chinese + English)
  3. Parse OCR text into structured vocabulary records
  4. Output a JSON array matching the target schema:
     [{"word", "phonetic", "pos", "meaning", "page",
       "版本", "年级", "册", "unit"}, ...]

Usage:
    python ocr_pipeline.py --pics ./pics --output result.json \
        --version 人教版 --grade 7年级 --volume 下册
"""

import argparse
import json
import re
import sys
from pathlib import Path

import cv2
import numpy as np
import pytesseract
from PIL import Image


# ---------------------------------------------------------------------------
# Image preprocessing
# ---------------------------------------------------------------------------

def deskew(image: np.ndarray) -> np.ndarray:
    """Correct skew using Hough line transform."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image.copy()
    gray = cv2.bitwise_not(gray)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(thresh > 0))
    if len(coords) < 10:
        return image
    angle = cv2.minAreaRect(coords)[-1]
    # minAreaRect returns angles in [-90, 0); normalise to [-45, 45)
    if angle < -45:
        angle = 90 + angle
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        image, M, (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return rotated


def crop_borders(image: np.ndarray, margin: int = 10) -> np.ndarray:
    """Remove dark/noisy borders by finding the bounding box of content."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image.copy()
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return image
    all_pts = np.concatenate(contours)
    x, y, w, h = cv2.boundingRect(all_pts)
    # Add a small margin back
    x = max(0, x - margin)
    y = max(0, y - margin)
    x2 = min(image.shape[1], x + w + margin * 2)
    y2 = min(image.shape[0], y + h + margin * 2)
    return image[y:y2, x:x2]


def binarize(image: np.ndarray) -> np.ndarray:
    """Adaptive thresholding for clean black-on-white text."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image.copy()
    # Denoise first
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    binary = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=31,
        C=10,
    )
    return binary


def upscale_if_small(image: np.ndarray, min_height: int = 1000) -> np.ndarray:
    """Upscale low-resolution images so Tesseract performs better."""
    h, w = image.shape[:2]
    if h < min_height:
        scale = min_height / h
        image = cv2.resize(image, (int(w * scale), min_height), interpolation=cv2.INTER_CUBIC)
    return image


def preprocess(image_path: Path) -> np.ndarray:
    """Full preprocessing pipeline for a single image."""
    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")
    img = upscale_if_small(img)
    img = deskew(img)
    img = crop_borders(img)
    img = binarize(img)
    return img


# ---------------------------------------------------------------------------
# OCR
# ---------------------------------------------------------------------------

def run_ocr(image: np.ndarray, lang: str = "chi_sim+eng") -> str:
    """Run Tesseract on a preprocessed (binary) image."""
    pil_img = Image.fromarray(image)
    custom_config = r"--oem 3 --psm 6"
    text = pytesseract.image_to_string(pil_img, lang=lang, config=custom_config)
    return text


# ---------------------------------------------------------------------------
# Text parsing
# ---------------------------------------------------------------------------

# Patterns for vocabulary entries.
# Typical line formats found in Chinese EFL textbooks:
#   fox  /fɒks/  n.  狐狸  p.2
#   take care of  phrase  照顾；处理  p.2
#   (unit header)  Unit 1  / 第一单元

PHONETIC_RE = re.compile(r"(/[^/]+/|[ˈˌ][^\s]+)")
POS_RE = re.compile(
    r"\b(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|interj\.|num\.|art\.|phrase|abbr\.)\b"
)
PAGE_RE = re.compile(r"\bp\.?\s*(\d+)\b", re.IGNORECASE)
UNIT_RE = re.compile(r"\bUnit\s*(\d+)\b", re.IGNORECASE)
CHINESE_RE = re.compile(r"[\u4e00-\u9fff；、，。！？]+")


def parse_ocr_text(
    text: str,
    page_label: str,
    version: str,
    grade: str,
    volume: str,
) -> list[dict]:
    """
    Parse raw OCR text into a list of vocabulary record dicts.

    Strategy:
    - Split into lines, skip blanks.
    - Track current unit from unit-header lines.
    - For each content line, extract: word, phonetic, pos, meaning, page.
    """
    records: list[dict] = []
    current_unit = ""

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    for line in lines:
        # Detect unit header
        unit_match = UNIT_RE.search(line)
        if unit_match and len(line) < 30:
            current_unit = f"Unit {unit_match.group(1)}"
            continue

        # Extract components
        phonetic_match = PHONETIC_RE.search(line)
        pos_match = POS_RE.search(line)
        page_match = PAGE_RE.search(line)
        chinese_matches = CHINESE_RE.findall(line)

        phonetic = phonetic_match.group(0) if phonetic_match else ""
        pos = pos_match.group(0) if pos_match else ""
        page = f"p.{page_match.group(1)}" if page_match else page_label
        meaning = "；".join(chinese_matches) if chinese_matches else ""

        # Derive the English word: remove known extracted parts from line
        word_line = line
        for pat in [phonetic, pos, page_match.group(0) if page_match else "", *chinese_matches]:
            if pat:
                word_line = word_line.replace(pat, " ")
        # Clean up and take the first meaningful token(s)
        word_tokens = [t for t in word_line.split() if t and not t.startswith("/")]
        word = " ".join(word_tokens[:4]).strip(".,;:()[]")

        # Skip lines that don't look like vocabulary entries
        if not word or (not meaning and not pos):
            continue
        # Skip very long "words" (likely OCR noise)
        if len(word) > 60:
            continue

        records.append({
            "word": word,
            "phonetic": phonetic,
            "pos": pos,
            "meaning": meaning,
            "page": page,
            "版本": version,
            "年级": grade,
            "册": volume,
            "unit": current_unit,
        })

    return records


# ---------------------------------------------------------------------------
# Pipeline orchestration
# ---------------------------------------------------------------------------

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"}


def natural_sort_key(path: Path):
    """Sort filenames with embedded numbers naturally (1, 2, 10 not 1, 10, 2)."""
    parts = re.split(r"(\d+)", path.stem)
    return [int(p) if p.isdigit() else p.lower() for p in parts]


def run_pipeline(
    pics_dir: Path,
    output_path: Path,
    version: str,
    grade: str,
    volume: str,
    lang: str,
    save_preprocessed: bool,
) -> None:
    image_files = sorted(
        [p for p in pics_dir.iterdir() if p.suffix.lower() in SUPPORTED_EXTENSIONS],
        key=natural_sort_key,
    )

    if not image_files:
        print(f"No images found in {pics_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(image_files)} image(s) in {pics_dir}")

    all_records: list[dict] = []
    preprocessed_dir = pics_dir / "_preprocessed"

    for idx, img_path in enumerate(image_files, start=1):
        print(f"  [{idx}/{len(image_files)}] Processing {img_path.name} ...", end=" ", flush=True)

        try:
            processed = preprocess(img_path)
        except ValueError as exc:
            print(f"SKIP ({exc})")
            continue

        if save_preprocessed:
            preprocessed_dir.mkdir(exist_ok=True)
            cv2.imwrite(str(preprocessed_dir / img_path.name), processed)

        ocr_text = run_ocr(processed, lang=lang)

        # Use filename stem as fallback page label (e.g. "p3" → "p.3")
        stem = img_path.stem
        page_label_match = re.search(r"\d+", stem)
        page_label = f"p.{page_label_match.group()}" if page_label_match else stem

        records = parse_ocr_text(ocr_text, page_label, version, grade, volume)
        all_records.extend(records)
        print(f"→ {len(records)} record(s)")

    print(f"\nTotal records extracted: {len(all_records)}")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_records, f, ensure_ascii=False, indent=2)

    print(f"Saved to {output_path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="OCR pipeline: preprocess images → Tesseract → structured JSON"
    )
    p.add_argument("--pics", default="./pics", help="Directory containing input images")
    p.add_argument("--output", default="result.json", help="Output JSON file path")
    p.add_argument("--version", default="人教版", help='Textbook version, e.g. "人教版"')
    p.add_argument("--grade", default="7年级", help='Grade, e.g. "7年级"')
    p.add_argument("--volume", default="下册", help='Volume, e.g. "上册" or "下册"')
    p.add_argument(
        "--lang",
        default="chi_sim+eng",
        help="Tesseract language string (default: chi_sim+eng)",
    )
    p.add_argument(
        "--save-preprocessed",
        action="store_true",
        help="Save preprocessed images to pics/_preprocessed/ for inspection",
    )
    return p


def main() -> None:
    args = build_parser().parse_args()
    pics_dir = Path(args.pics)
    if not pics_dir.is_dir():
        print(f"Error: --pics directory not found: {pics_dir}", file=sys.stderr)
        sys.exit(1)
    run_pipeline(
        pics_dir=pics_dir,
        output_path=Path(args.output),
        version=args.version,
        grade=args.grade,
        volume=args.volume,
        lang=args.lang,
        save_preprocessed=args.save_preprocessed,
    )


if __name__ == "__main__":
    main()
