#!/usr/bin/env python3
"""
Download vocab JSON from remote URL and import into Supabase PostgreSQL.
Usage: python import_vocab.py --password YOUR_SUPABASE_PASSWORD
"""

import argparse
import json
import sys
import urllib.request
import uuid

import psycopg2

DATA_URL = "https://f.130222.xyz/api/file-download/GK14uJ"
DB_HOST = "aws-1-ap-northeast-2.pooler.supabase.com"
DB_PORT = 5432
DB_NAME = "postgres"
DB_USER = "postgres.alsquaomptsmzhkoscim"

GRADE_MAP = {
    "7年级": 7,
    "8年级": 8,
    "9年级": 9,
    "10年级": 10,
    "11年级": 11,
    "12年级": 12,
}

SEMESTER_MAP = {
    "上册": "1",
    "下册": "2",
}


def download_json(url: str) -> list[dict]:
    print(f"Downloading data from {url} ...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    print(f"Downloaded {len(data)} records.")
    return data


def connect(password: str):
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=password,
        sslmode="require",
    )


def import_words(conn, records: list[dict]) -> int:
    """Insert words with owner_id = NULL (shared/system words)."""
    insert_sql = """
        insert into words (id, unit, word, phonetic, meaning, pos, page,
                           owner_id, publisher, grade, semester)
        values (%s, %s, %s, %s, %s, %s, %s, NULL, %s, %s, %s)
        on conflict (id) do nothing
    """
    rows = []
    for rec in records:
        grade_str = rec.get("年级", "")
        semester_str = rec.get("册", "")
        rows.append((
            str(uuid.uuid4()),
            rec.get("unit", ""),
            rec.get("word", ""),
            rec.get("phonetic", ""),
            rec.get("meaning", ""),
            rec.get("pos"),
            rec.get("page"),
            rec.get("版本"),
            GRADE_MAP.get(grade_str),
            SEMESTER_MAP.get(semester_str),
        ))

    with conn.cursor() as cur:
        cur.executemany(insert_sql, rows)
    conn.commit()
    return len(rows)


def main():
    parser = argparse.ArgumentParser(description="Import vocab JSON into Supabase")
    parser.add_argument("--password", required=True, help="Supabase postgres password")
    args = parser.parse_args()

    records = download_json(DATA_URL)

    print("Connecting to Supabase ...")
    try:
        conn = connect(args.password)
    except Exception as e:
        print(f"Connection failed: {e}", file=sys.stderr)
        sys.exit(1)

    print("Connected. Importing words ...")
    try:
        count = import_words(conn, records)
        print(f"Done. Inserted {count} words.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
