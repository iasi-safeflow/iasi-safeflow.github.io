"""The mobile app mirrors the 112 keyword list so it can stop the form offline. Fail if the two drift apart."""

import re
from pathlib import Path

import pytest

from app import safety

CLIENT_FILE = Path(__file__).resolve().parents[2] / "mobile" / "src" / "lib" / "safety.ts"


@pytest.mark.skipif(not CLIENT_FILE.exists(), reason="mobile app not present")
def test_client_keywords_match_server():
    source = CLIENT_FILE.read_text(encoding="utf-8")
    block = re.search(r"const KEYWORDS = \[(.*?)\];", source, re.S)
    assert block, "KEYWORDS array not found in safety.ts"
    client = [s.replace("\\\\", "\\") for s in re.findall(r"'((?:[^'\\]|\\.)*)'", block.group(1))]
    assert client == safety._KEYWORDS


@pytest.mark.skipif(not CLIENT_FILE.exists(), reason="mobile app not present")
def test_client_message_matches_server():
    assert safety.EMERGENCY_MESSAGE_RO in CLIENT_FILE.read_text(encoding="utf-8")
