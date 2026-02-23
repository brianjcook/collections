from __future__ import annotations

import json
import pathlib
import urllib.error
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo


ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def nyt_date_string() -> str:
    eastern_now = datetime.now(ZoneInfo("America/New_York"))
    return eastern_now.strftime("%Y-%m-%d")


def fetch_nyt_payload(date_str: str) -> dict:
    url = f"https://www.nytimes.com/svc/connections/v2/{date_str}.json"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Referer": "https://www.nytimes.com/games/connections",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status < 200 or response.status >= 300:
            raise RuntimeError(f"Unexpected NYT status: {response.status}")
        return json.loads(response.read().decode("utf-8"))


def extract_words(payload: dict) -> list[str]:
    words: list[str] = []

    if isinstance(payload.get("words"), list):
        words.extend(str(w).strip().upper() for w in payload["words"])

    cards = payload.get("cards")
    if isinstance(cards, list):
        for card in cards:
            members = card.get("members") if isinstance(card, dict) else None
            if isinstance(members, list):
                words.extend(str(w).strip().upper() for w in members)

    words = [w for w in words if w]
    if len(words) < 16:
        raise RuntimeError(f"Expected at least 16 words, got {len(words)}")
    return words[:16]


def write_json(path: pathlib.Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    date_str = nyt_date_string()
    try:
        payload = fetch_nyt_payload(date_str)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"NYT HTTP error: {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"NYT URL error: {exc.reason}") from exc

    words = extract_words(payload)
    output = {
        "date": date_str,
        "words": words,
        "updated_at_utc": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
    }

    dated_path = DATA_DIR / f"connections-{date_str}.json"
    latest_path = DATA_DIR / "connections-latest.json"
    write_json(dated_path, output)
    write_json(latest_path, output)
    print(f"Wrote {dated_path.name} and {latest_path.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
