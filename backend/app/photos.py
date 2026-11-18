"""Optional reviewer-only photo handling: MIME/magic validation and pure-Python EXIF/metadata stripping."""

import base64
import binascii
import sqlite3
import struct

MAX_PHOTOS_PER_REPORT = 2
MAX_PHOTO_BYTES = 1_000_000
MIN_PHOTO_BYTES = 32
ALLOWED_IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp")

_JPEG_ALLOWED_MARKERS = {
    0xE0,  # APP0 (JFIF) — pixel aspect info only, no EXIF/GPS/XMP
    0xDB,  # DQT
    0xC0, 0xC1, 0xC2, 0xC3,  # SOF0..SOF3
    0xC4,  # DHT
    0xDD,  # DRI
}
_JPEG_SOF_MARKERS = {0xC0, 0xC1, 0xC2, 0xC3}
_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_PNG_SAFE_CHUNKS = {b"IHDR", b"PLTE", b"IDAT", b"IEND", b"tRNS", b"sRGB", b"gAMA", b"cHRM"}


def _strip_jpeg_metadata(raw: bytes) -> bytes:
    """Drop EXIF (APP1), XMP/ICC/IPTC (APP2..APP15) and COM segments from a JPEG."""
    if not raw.startswith(b"\xff\xd8"):
        raise ValueError("Fișier JPEG invalid.")
    out = bytearray(b"\xff\xd8")
    pos = 2
    n = len(raw)
    saw_sof = False
    while pos < n:
        if raw[pos] != 0xFF:
            raise ValueError("Structură JPEG invalidă.")
        while pos < n and raw[pos] == 0xFF:
            pos += 1
        if pos >= n:
            raise ValueError("Fișier JPEG trunchiat.")
        marker = raw[pos]
        pos += 1
        if marker == 0xD9:  # EOI before SOS
            out.extend((0xFF, marker))
            break
        if marker == 0x00 or 0xD0 <= marker <= 0xD7 or marker == 0x01:
            continue
        if pos + 2 > n:
            raise ValueError("Segment JPEG trunchiat.")
        seg_len = struct.unpack(">H", raw[pos : pos + 2])[0]
        if seg_len < 2 or pos + seg_len > n:
            raise ValueError("Lungime de segment JPEG invalidă.")
        if marker == 0xDA:  # SOS: image scan payload runs until EOF
            if not saw_sof:
                raise ValueError("Imagine JPEG incompletă.")
            out.extend((0xFF, 0xDA))
            out.extend(raw[pos:])
            return bytes(out)
        if marker in _JPEG_SOF_MARKERS:
            saw_sof = True
        if marker in _JPEG_ALLOWED_MARKERS:
            out.extend((0xFF, marker))
            out.extend(raw[pos : pos + seg_len])
        pos += seg_len
    raise ValueError("Imagine JPEG fără date de imagine.")


def _strip_png_metadata(raw: bytes) -> bytes:
    """Keep only essential image/color PNG chunks, dropping eXIf, tEXt, zTXt, iTXt, pHYs and tIME."""
    if not raw.startswith(_PNG_SIGNATURE):
        raise ValueError("Fișier PNG invalid.")
    out = bytearray(_PNG_SIGNATURE)
    pos = len(_PNG_SIGNATURE)
    n = len(raw)
    saw_ihdr = False
    saw_iend = False
    while pos + 8 <= n:
        length = struct.unpack(">I", raw[pos : pos + 4])[0]
        ctype = raw[pos + 4 : pos + 8]
        end = pos + 12 + length
        if end > n:
            raise ValueError("Fișier PNG trunchiat.")
        if ctype == b"IHDR":
            saw_ihdr = True
        if ctype in _PNG_SAFE_CHUNKS:
            out.extend(raw[pos:end])
        pos = end
        if ctype == b"IEND":
            saw_iend = True
            break
    if not (saw_ihdr and saw_iend):
        raise ValueError("Imagine PNG incompletă.")
    return bytes(out)


def _strip_webp_metadata(raw: bytes) -> bytes:
    """Drop EXIF, XMP and ICCP chunks from a WebP RIFF container."""
    if len(raw) < 12 or raw[:4] != b"RIFF" or raw[8:12] != b"WEBP":
        raise ValueError("Fișier WebP invalid.")
    body = bytearray()
    pos = 12
    n = len(raw)
    has_frame = False
    while pos + 8 <= n:
        fourcc = raw[pos : pos + 4]
        size = struct.unpack("<I", raw[pos + 4 : pos + 8])[0]
        padded = size + (size & 1)
        if pos + 8 + size > n:
            raise ValueError("Fișier WebP trunchiat.")
        chunk_data = bytearray(raw[pos + 8 : pos + 8 + size])
        if fourcc not in (b"EXIF", b"XMP ", b"ICCP"):
            if fourcc == b"VP8X" and len(chunk_data) >= 1:
                # Clear ICCP (0x20), EXIF (0x08) and XMP (0x04) bits in the VP8X flags byte.
                chunk_data[0] &= ~(0x20 | 0x08 | 0x04)
            if fourcc in (b"VP8 ", b"VP8L", b"ANIM", b"ANMF"):
                has_frame = True
            body.extend(fourcc)
            body.extend(struct.pack("<I", size))
            body.extend(chunk_data)
            if size & 1:
                body.append(0)
        pos += 8 + padded
    if not has_frame:
        raise ValueError("Imagine WebP incompletă.")
    riff_size = 4 + len(body)
    return b"RIFF" + struct.pack("<I", riff_size) + b"WEBP" + bytes(body)


def _detect_mime(raw: bytes) -> str:
    if raw.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if raw.startswith(_PNG_SIGNATURE):
        return "image/png"
    if len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    raise ValueError("Format imagine nesuportat. Folosiți JPEG, PNG sau WebP.")


def decode_and_sanitize_photo(data_or_uri: str, declared_mime: str | None = None) -> tuple[str, bytes]:
    """Decode base64/data-URI image, verify size & magic bytes, and strip EXIF/metadata."""
    s = data_or_uri.strip()
    header_mime: str | None = None
    if s.startswith("data:"):
        head, sep, rest = s.partition(",")
        if not sep or ";base64" not in head.lower():
            raise ValueError("Datele fotografiei trebuie codificate base64.")
        header_mime = head[5:].split(";", 1)[0].strip().lower() or None
        s = rest.strip()
    if len(s) > (MAX_PHOTO_BYTES * 4 // 3) + 256:
        raise ValueError("Fotografia depășește dimensiunea maximă permisă (1 MB).")
    try:
        raw = base64.b64decode(s, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Fotografia nu este un conținut base64 valid.") from exc

    if len(raw) < MIN_PHOTO_BYTES or len(raw) > MAX_PHOTO_BYTES:
        raise ValueError("Fotografia trebuie să aibă între 32 B și 1 MB.")

    detected = _detect_mime(raw)
    for hint in (declared_mime, header_mime):
        if hint:
            norm = "image/jpeg" if hint.lower() == "image/jpg" else hint.lower()
            if norm not in ALLOWED_IMAGE_TYPES or norm != detected:
                raise ValueError("Tipul declarat al fotografiei nu corespunde cu fișierul.")

    if detected == "image/jpeg":
        clean = _strip_jpeg_metadata(raw)
    elif detected == "image/png":
        clean = _strip_png_metadata(raw)
    else:
        clean = _strip_webp_metadata(raw)
    return detected, clean


def photo_counts(db: sqlite3.Connection, report_ids: list[int]) -> dict[int, int]:
    if not report_ids:
        return {}
    marks = ",".join("?" * len(report_ids))
    rows = db.execute(
        f"SELECT report_id, COUNT(*) AS cnt FROM report_photos WHERE report_id IN ({marks}) GROUP BY report_id",
        report_ids,
    ).fetchall()
    return {r["report_id"]: int(r["cnt"]) for r in rows}


def review_photo_out(row: sqlite3.Row) -> dict:
    b64 = base64.b64encode(row["data"]).decode("ascii")
    return {
        "id": row["id"],
        "mime_type": row["mime_type"],
        "size_bytes": int(row["size_bytes"]),
        "created_at": row["created_at"],
        "data_url": f"data:{row['mime_type']};base64,{b64}",
    }
