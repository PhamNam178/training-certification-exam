"""
================================================================
  Import PD1 Questions (Enriched) → Supabase
  
  Input:  public/data/pd1_enriched.json
  Output: Supabase table: questions
  
  Chạy: python3 import_to_supabase.py
================================================================
"""

import os
import json
import time
from typing import Optional

try:
    from supabase import create_client, Client
except ImportError:
    print("Chưa cài: pip install supabase")
    exit(1)

from dotenv import load_dotenv
load_dotenv()

# === CẤU HÌNH ===
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

# Đường dẫn file enriched
INPUT_JSON = os.path.join(os.path.dirname(__file__), "../public/data/pd1_enriched.json")

CERT_ID    = "pd1"
BATCH_SIZE = 50

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_KEY trong .env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def load_data():
    """Load file JSON enriched."""
    if not os.path.exists(INPUT_JSON):
        print(f"❌ Không tìm thấy file: {INPUT_JSON}")
        exit(1)
        
    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


def question_to_row(q: dict) -> dict:
    """Chuyển 1 câu hỏi từ JSON Enriched sang format row cho Supabase."""
    return {
        "cert_id":          CERT_ID,
        "question_no":      q["id"],
        "question_en":      q["question_en"],
        "options":          q["options"],
        "correct":          q["correct"],
        "correct_verified": q.get("correct_verified"),
        "answer_changed":   q.get("answer_changed", False),
        "is_multi":         bool(q.get("is_multi", False)),
        "question_vi":      q.get("question_vi"),
        "options_vi":       q.get("options_vi"),
        "ai_expert":        q.get("ai_expert"),
        "ai_expert_updated_at": "NOW()" if q.get("ai_expert") else None,
    }


def ensure_cert_exists():
    """Đảm bảo cert PD1 đã có trong DB."""
    res = supabase.table("certifications").select("id").eq("id", CERT_ID).execute()
    if not res.data:
        supabase.table("certifications").insert({
            "id":         CERT_ID,
            "name":       "Platform Developer I",
            "short_name": "PD1",
            "vendor":     "Salesforce",
        }).execute()
        print(f"✅ Đã tạo certification: {CERT_ID}")


def insert_batch(rows: list) -> int:
    """Insert một batch rows dùng upsert."""
    try:
        clean_rows = []
        for r in rows:
            row = dict(r)
            if row.get("ai_expert_updated_at") == "NOW()":
                row["ai_expert_updated_at"] = None # Supabase handle
            clean_rows.append(row)

        res = supabase.table("questions").upsert(
            clean_rows,
            on_conflict="cert_id,question_no"
        ).execute()
        return len(res.data) if res.data else len(clean_rows)
    except Exception as e:
        print(f"  ❌ Lỗi insert batch: {str(e)[:200]}")
        return 0


def main():
    print("=" * 60)
    print(f"🚀  Import {CERT_ID.upper()} Enriched → Supabase")
    print("=" * 60)

    # 1. Load data
    questions = load_data()
    total = len(questions)
    
    # 2. Đảm bảo cert tồn tại
    ensure_cert_exists()

    # 3. Import theo batch
    print(f"\n--- Đang xử lý {total} câu hỏi ---")
    success = 0
    batch = []

    try:
        for i, q in enumerate(questions):
            row = question_to_row(q)
            batch.append(row)

            if len(batch) >= BATCH_SIZE or i == total - 1:
                count = insert_batch(batch)
                success += count
                print(f"  ✅ Đã xử lý: {i+1}/{total}")
                batch = []
                time.sleep(0.2)

    except KeyboardInterrupt:
        print("\n🛑 Dừng thủ công")

    # 4. Cập nhật total_questions
    supabase.table("certifications") \
        .update({"total_questions": total}) \
        .eq("id", CERT_ID).execute()

    print(f"\n{'=' * 60}")
    print(f"📊 Hoàn tất!")
    print(f"   ✅ Tổng số câu trong DB: {total}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
