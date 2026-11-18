"""Tests for optional reviewer-only photos: EXIF stripping, magic-byte validation, AI bonus, points & redaction."""

import base64
import sqlite3
import struct

from app.photos import decode_and_sanitize_photo
from conftest import auth_header, valid_report


def _jpeg_with_exif(secret: bytes = b"Exif\x00\x00GPS_SECRET_47_27") -> bytes:
    # Minimal valid JPEG structure: SOI + APP0 + APP1(EXIF) + DQT + SOF0 + DHT + SOS + scan data + EOI
    def seg(marker: int, payload: bytes) -> bytes:
        return bytes([0xFF, marker]) + struct.pack(">H", len(payload) + 2) + payload

    return (
        b"\xff\xd8"
        + seg(0xE0, b"JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00")
        + seg(0xE1, secret)
        + seg(0xFE, b"COMMENT_SECRET")
        + seg(0xDB, b"\x00" + b"\x10" * 64)
        + seg(0xC0, b"\x08\x00\x01\x00\x01\x01\x01\x11\x00")
        + seg(0xC4, b"\x00" + b"\x00" * 16)
        + seg(0xDA, b"\x01\x01\x00\x00\x3f\x00")
        + b"\x00\xff\xd9"
    )


def _png_with_text(secret: bytes = b"Author\x00CAMERA_SERIAL_123") -> bytes:
    def chunk(ctype: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + ctype + data + b"\x00\x00\x00\x00"

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
        + chunk(b"eXIf", b"GPS_LAT_SECRET")
        + chunk(b"tEXt", secret)
        + chunk(b"IDAT", b"\x78\x9c\x63\x00\x00\x00\x02\x00\x01")
        + chunk(b"IEND", b"")
    )


def _webp_with_exif(secret: bytes = b"WEBP_GPS_TAG_SECRET") -> bytes:
    def sub(fourcc: bytes, data: bytes) -> bytes:
        pad = b"\x00" if len(data) % 2 else b""
        return fourcc + struct.pack("<I", len(data)) + data + pad

    body = (
        sub(b"VP8X", b"\x08\x00\x00\x00\x00\x00\x00\x00\x00\x00")
        + sub(b"EXIF", secret)
        + sub(b"VP8 ", b"\x00" * 16)
    )
    return b"RIFF" + struct.pack("<I", 4 + len(body)) + b"WEBP" + body


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def test_metadata_stripping_removes_exif_and_comments_from_jpeg_png_webp():
    mime, clean_jpg = decode_and_sanitize_photo(f"data:image/jpeg;base64,{_b64(_jpeg_with_exif())}")
    assert mime == "image/jpeg"
    assert b"GPS_SECRET" not in clean_jpg and b"COMMENT_SECRET" not in clean_jpg
    assert clean_jpg.startswith(b"\xff\xd8")

    mime_p, clean_png = decode_and_sanitize_photo(_b64(_png_with_text()), "image/png")
    assert mime_p == "image/png"
    assert b"CAMERA_SERIAL" not in clean_png and b"GPS_LAT_SECRET" not in clean_png
    assert b"IHDR" in clean_png and b"IEND" in clean_png

    mime_w, clean_webp = decode_and_sanitize_photo(_b64(_webp_with_exif()), "image/webp")
    assert mime_w == "image/webp"
    assert b"WEBP_GPS_TAG_SECRET" not in clean_webp and b"EXIF" not in clean_webp
    # VP8X flag bit for EXIF (0x08) cleared too
    vp8x_pos = clean_webp.find(b"VP8X")
    assert vp8x_pos != -1 and (clean_webp[vp8x_pos + 8] & 0x08) == 0


def test_112_gate_still_blocks_before_saving_photos(client, settings, reporter_token):
    payload = valid_report(
        immediate_danger=True,
        photos=[{"data": _b64(_jpeg_with_exif()), "mime_type": "image/jpeg"}],
    )
    r = client.post("/reports", json=payload, headers=auth_header(reporter_token))
    assert r.status_code == 400 and r.json()["detail"]["code"] == "call_112"
    conn = sqlite3.connect(settings.database_path)
    assert conn.execute("SELECT COUNT(*) FROM reports").fetchone()[0] == 0
    assert conn.execute("SELECT COUNT(*) FROM report_photos").fetchone()[0] == 0


def test_invalid_mime_fake_image_or_too_many_photos_rejected(client, reporter_token):
    h = auth_header(reporter_token)
    bad_magic = client.post(
        "/reports",
        json=valid_report(photos=[{"data": _b64(b"not-an-image-" * 8), "mime_type": "image/jpeg"}]),
        headers=h,
    )
    assert bad_magic.status_code == 422

    mismatch = client.post(
        "/reports",
        json=valid_report(photos=[{"data": _b64(_png_with_text()), "mime_type": "image/jpeg"}]),
        headers=h,
    )
    assert mismatch.status_code == 422

    too_many = client.post(
        "/reports",
        json=valid_report(
            photos=[
                {"data": _b64(_jpeg_with_exif()), "mime_type": "image/jpeg"},
                {"data": _b64(_jpeg_with_exif()), "mime_type": "image/jpeg"},
                {"data": _b64(_jpeg_with_exif()), "mime_type": "image/jpeg"},
            ]
        ),
        headers=h,
    )
    assert too_many.status_code == 422


def test_photos_are_reviewer_only_stripped_and_award_ai_and_civic_bonus(client, reporter_token, reviewer_token):
    hr = auth_header(reporter_token)
    hrev = auth_header(reviewer_token)

    r = client.post(
        "/reports",
        json=valid_report(photos=[{"data": _b64(_jpeg_with_exif()), "mime_type": "image/jpeg"}]),
        headers=hr,
    )
    assert r.status_code == 201, r.text
    created = r.json()
    pid = created["public_id"]
    assert created["photos_count"] == 1

    # Public endpoints NEVER expose photos or photo counts
    pub_list = client.get("/public/reports").json()
    pub_item = next(item for item in pub_list if item["public_id"] == pid)
    assert "photos" not in pub_item and "photos_count" not in pub_item
    pub_detail = client.get(f"/public/reports/{pid}").json()
    assert "photos" not in pub_detail and "photos_count" not in pub_detail

    # Non-reviewers cannot access reviewer photo endpoints
    assert client.get(f"/review/reports/{pid}/photos").status_code == 401
    assert client.get(f"/review/reports/{pid}/photos", headers=hr).status_code == 403

    # Assistant awarded +10 evidence_photo
    assistant = client.get(f"/review/reports/{pid}/assistant", headers=hrev).json()
    photo_factor = next(f for f in assistant["latest"]["importance"]["factors"] if f["code"] == "evidence_photo")
    assert photo_factor["points"] == 10 and photo_factor["detail"] is True

    # Reviewer fetches stripped photo cleanly
    rev_detail = client.get(f"/review/reports/{pid}", headers=hrev).json()
    assert rev_detail["photos_count"] == 1
    photos = client.get(f"/review/reports/{pid}/photos", headers=hrev).json()
    assert len(photos) == 1
    assert photos[0]["mime_type"] == "image/jpeg"
    assert photos[0]["data_url"].startswith("data:image/jpeg;base64,")
    decoded = base64.b64decode(photos[0]["data_url"].split(",", 1)[1])
    assert b"GPS_SECRET" not in decoded and b"COMMENT_SECRET" not in decoded

    # 0 points while submitted; +15 validated + +5 photo bonus once validated by a reviewer
    assert client.get("/auth/points", headers=hr).json()["balance"] == 0
    val = client.post(f"/review/reports/{pid}/status", json={"status": "validated"}, headers=hrev)
    assert val.status_code == 200
    pts = client.get("/auth/points", headers=hr).json()
    assert pts["balance"] == 20  # 15 report_validated + 5 report_photo_bonus (short description)
    assert {e["kind"] for e in pts["history"]} == {"report_validated", "report_photo_bonus"}

    # Dossier mentions attached internal photo count cleanly
    dossier = client.get(f"/review/reports/{pid}/dossier", headers=hrev).json()
    assert "Dovezi foto atașate (vizibile exclusiv recenzentului): 1" in dossier["text"]

    # Reviewer can remove a photo (e.g. contains face/plate); audit logged and assistant rechecked
    photo_id = photos[0]["id"]
    assert client.post(f"/review/photos/{photo_id}/remove", headers=hr).status_code == 403
    rem = client.post(f"/review/photos/{photo_id}/remove", headers=hrev)
    assert rem.status_code == 200 and rem.json()["removed"] is True
    assert client.get(f"/review/reports/{pid}/photos", headers=hrev).json() == []
    audit = client.get(f"/review/reports/{pid}/audit", headers=hrev).json()
    assert any(e["action"] == "photo_removed" for e in audit)
    rechecked = client.get(f"/review/reports/{pid}/assistant", headers=hrev).json()
    pf_after = next(f for f in rechecked["latest"]["importance"]["factors"] if f["code"] == "evidence_photo")
    assert pf_after["points"] == 0 and pf_after["detail"] is False
