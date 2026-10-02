"""Pull everything listed in config.yaml into docs/data/market.json.

Yahoo Finance supplies live market prices; FRED supplies official data.
If a source fails, the last good value is kept and marked stale.
"""
import csv
import io
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

import requests
import yaml

ROOT = Path(__file__).parent
OUT = ROOT / "docs" / "data" / "market.json"
MAX_POINTS = 260  # about a year of trading days
HEADERS = {"User-Agent": "Mozilla/5.0 (market-monitor)"}
FRED_API_KEY = os.environ.get("FRED_API_KEY", "").strip()

session = requests.Session()
session.headers.update(HEADERS)


def get(url, timeout=30, tries=3):
    for attempt in range(tries):
        try:
            r = session.get(url, timeout=timeout)
            r.raise_for_status()
            return r
        except requests.RequestException:
            if attempt == tries - 1:
                raise
            time.sleep(2 * (attempt + 1))


def fetch_yahoo(symbol):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(symbol)}?range=1y&interval=1d"
    result = get(url).json()["chart"]["result"][0]
    meta = result["meta"]
    closes = result["indicators"]["quote"][0]["close"]
    tz = timezone(timedelta(seconds=meta.get("gmtoffset", 0)))
    history = [
        [datetime.fromtimestamp(ts, tz).strftime("%Y-%m-%d"), c]
        for ts, c in zip(result.get("timestamp", []), closes)
        if c is not None
    ]
    price = meta.get("regularMarketPrice")
    stamp = meta.get("regularMarketTime")
    if price is not None and stamp:
        today = datetime.fromtimestamp(stamp, tz).strftime("%Y-%m-%d")
        if history and history[-1][0] == today:
            history[-1][1] = price
        else:
            history.append([today, price])
    as_of = datetime.fromtimestamp(stamp, timezone.utc).isoformat() if stamp else history[-1][0]
    return history, as_of


def fetch_fred(series_id):
    start = (datetime.now(timezone.utc) - timedelta(days=3 * 365)).strftime("%Y-%m-%d")
    if FRED_API_KEY:
        url = (
            "https://api.stlouisfed.org/fred/series/observations"
            f"?series_id={series_id}&observation_start={start}&api_key={FRED_API_KEY}&file_type=json"
        )
        rows = [(o["date"], o["value"]) for o in get(url).json()["observations"]]
    else:
        url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={start}"
        reader = csv.reader(io.StringIO(get(url, timeout=60).text))
        next(reader)
        rows = [(r[0], r[1]) for r in reader if len(r) >= 2]
    history = []
    for date, value in rows:
        try:
            history.append([date, float(value)])
        except ValueError:
            pass  # FRED uses "." for missing days
    return history, history[-1][0] if history else None


def build_item(cfg, previous):
    source = cfg["source"].lower()
    fetch = fetch_yahoo if source == "yahoo" else fetch_fred
    key = f"{source}:{cfg['symbol']}"
    try:
        history, as_of = fetch(cfg["symbol"])
        if not history:
            raise ValueError("no data returned")
    except Exception as exc:  # keep the last good copy rather than dropping the card
        print(f"  ! {cfg['symbol']}: {exc}", file=sys.stderr)
        old = previous.get(key)
        if old:
            return {**old, "label": cfg["label"], "note": cfg.get("note", ""), "stale": True}, False
        return None, False

    scale = float(cfg.get("scale", 1))
    history = [[d, round(v * scale, 4)] for d, v in history[-MAX_POINTS:]]
    value = history[-1][1]
    prev = history[-2][1] if len(history) > 1 else None
    return {
        "key": key,
        "label": cfg["label"],
        "symbol": cfg["symbol"],
        "source": source,
        "unit": cfg.get("unit", "usd"),
        "note": cfg.get("note", ""),
        "value": value,
        "prev": prev,
        "prev_date": history[-2][0] if prev is not None else None,
        "as_of": as_of,
        "stale": False,
        "history": history,
    }, True


def main():
    config = yaml.safe_load((ROOT / "config.yaml").read_text(encoding="utf-8"))
    previous = {}
    if OUT.exists():
        for group in json.loads(OUT.read_text(encoding="utf-8")).get("groups", []):
            for item in group["items"]:
                previous[item["key"]] = item

    groups, ok, total = [], 0, 0
    for group in config["groups"]:
        print(group["name"])
        items = []
        for cfg in group["items"]:
            total += 1
            item, fresh = build_item(cfg, previous)
            ok += fresh
            if item:
                items.append(item)
                print(f"  {cfg['symbol']}: {item['value']}{' (stale)' if item['stale'] else ''}")
        groups.append({"name": group["name"], "items": items})

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {"updated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "groups": groups}
    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"\n{ok}/{total} series refreshed -> {OUT.relative_to(ROOT)}")
    if ok == 0:
        sys.exit("Every source failed; check network access.")


if __name__ == "__main__":
    main()
