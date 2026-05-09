"""
================================================================
  Salesforce Cert Exam — AI Expert Pipeline v3
  
  THAY ĐỔI SO VỚI v2:
  - AI vừa VERIFY đáp án (không tin mù file) vừa GIẢI THÍCH
  - Output thêm field: correct_verified, answer_changed
  - Nếu AI sửa đáp án → ghi log rõ để review

  Input:  ../public/data/pd1.json
  Output: ../public/data/pd1_enriched.json
  
  Mỗi row output:
  {
    "id", "question_en", "options", "correct" (từ file),
    "correct_verified" (AI xác minh — dùng cái này),
    "answer_changed" (true nếu AI sửa),
    "is_multi", "explanation", "question_vi", "options_vi",
    "ai_expert" (markdown dựa trên correct_verified)
  }

  Chạy: python3 enrich_expert.py
  Stop: Ctrl+C — Dữ liệu đã lưu KHÔNG bị mất (auto-resume)
================================================================
"""

import os
import json
import time
import re
import warnings
warnings.filterwarnings("ignore")

from typing import Optional

try:
    import google.generativeai as genai
except ImportError:
    print("Chưa cài: pip install -q -U google-generativeai python-dotenv")
    exit(1)

from dotenv import load_dotenv
load_dotenv()

# === CẤU HÌNH ===
BASE_DIR    = os.path.dirname(__file__)
INPUT_JSON  = os.path.join(BASE_DIR, "../public/data/pd1.json")
OUTPUT_JSON = os.path.join(BASE_DIR, "../public/data/pd1_enriched.json")
LOG_FILE    = os.path.join(BASE_DIR, "answer_corrections.log")

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    print("❌ Không tìm thấy GEMINI_API_KEY trong file .env")
    exit(1)

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash-lite")

# === GIỚI HẠN CHI PHÍ ===
COST_PER_ITEM_YEN = 0.08
MAX_COST_YEN      = 1000


def build_prompt(q: dict) -> str:
    """
    Prompt v4: AI verify đáp án + Dịch (giữ thuật ngữ English) + Giải thích Mẹo.
    """
    options_text = "\n".join(
        f"{key}. {val}" for key, val in sorted(q["options"].items())
    )
    num_correct = len(q["correct"].split(","))
    multi_note = f"(Chọn {num_correct} đáp án)" if num_correct > 1 else "(Chọn 1 đáp án)"

    return f"""Bạn là Salesforce Certified Platform Developer I với 10 năm kinh nghiệm.

**CÂU HỎI {multi_note}:**
{q['question']}

**CÁC ĐÁP ÁN:**
{options_text}

**ĐÁP ÁN TỪ PRACTICE EXAM (Tham khảo):** {q['correct']}

---
Nhiệm vụ:
1. Xác minh đáp án: Phân tích kỹ thuật dựa trên Salesforce Documentation. 
   - Tuyệt đối không được trả về "X", "unknown" hoặc giữ nguyên null. 
   - Bạn PHẢI đưa ra đáp án chính xác nhất (ví dụ: "A" hoặc "A,C"). 
   - Nếu đáp án từ file có vẻ sai, hãy dùng kiến thức chuyên gia để đính chính.
2. Dịch câu hỏi và đáp án sang tiếng Việt:
   - GIỮ NGUYÊN thuật ngữ chuyên ngành bằng tiếng Anh (ví dụ: Trigger, Custom Object, SOQL, Apex, Deployment, Flow, v.v.)
   - Cách diễn đạt tự nhiên, chuyên nghiệp.
3. Giải thích mẹo chọn đáp án (analysis).

Trả lời ĐÚNG format JSON (không thêm gì ngoài JSON):

{{
  "verified_correct": "Điền đáp án đúng nhất tại đây (ví dụ: 'A' hoặc 'A,B'). CẤM ĐIỀN 'X'",
  "is_file_correct": true hoặc false,
  "confidence": "high" hoặc "medium" hoặc "low",
  "correction_note": "Lý do chọn/sửa (giải thích ngắn gọn)",
  "question_vi": "Bản dịch câu hỏi (giữ thuật ngữ English)",
  "options_vi": {{
    "A": "Bản dịch đáp án A",
    "B": "Bản dịch đáp án B",
    ...
  }},
  "analysis": "## 💡 Mẹo chọn đáp án\\n(Phân tích ngắn gọn: ✅ tại sao đúng ❌ tại sao sai. Keyword và mẹo nhận diện nhanh.)"
}}"""

def parse_response(text: str) -> Optional[dict]:
    """Parse JSON response từ Gemini — robust với nhiều định dạng."""
    text = text.strip()
    # Bỏ markdown code block
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text).strip()

    # Thử parse trực tiếp
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Tìm JSON object đầu tiên trong text (greedy từ { đến })
    depth = 0
    start = text.find("{")
    if start == -1:
        return None
    for i, c in enumerate(text[start:], start):
        if c == "{": depth += 1
        elif c == "}": depth -= 1
        if depth == 0:
            try:
                return json.loads(text[start:i+1])
            except Exception:
                break

    # Fallback: regex
    match = re.search(r"\.\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return None


def call_gemini(q: dict) -> Optional[dict]:
    """
    Gọi Gemini, parse JSON response.
    Returns dict với keys: verified_correct, is_file_correct, correction_note, analysis
    """
    prompt = build_prompt(q)

    for attempt in range(3):
        try:
            response = model.generate_content(
                prompt,
                generation_config={
                    "temperature":    0.3,   # Thấp hơn để ổn định hơn
                    "max_output_tokens": 2500
                }
            )
            text = response.text.strip() if response.text else ""
            if not text:
                print(f"  ⚠️ Gemini trả về rỗng (thử {attempt+1}/3)...")
                time.sleep(2)
                continue

            parsed = parse_response(text)
            if parsed and "verified_correct" in parsed and "analysis" in parsed:
                return parsed

            # Nếu parse thất bại, thử lại
            print(f"  ⚠️ Không parse được JSON (thử {attempt+1}/3)...")
            time.sleep(2)

        except Exception as e:
            err = str(e)
            if "429" in err or "quota" in err.lower() or "RESOURCE_EXHAUSTED" in err:
                print("  ⏳ Lỗi 429: Hết quota / Rate limit.")
                return "QUOTA_EXHAUSTED"
            print(f"  ⚠️ Lỗi API (thử {attempt+1}/3): {err[:120]}")
            time.sleep(3)

    return None


def normalize_correct(correct_str: str) -> str:
    """Chuẩn hóa đáp án: sort và uppercase. 'B,A' → 'A,B'"""
    keys = [k.strip().upper() for k in correct_str.split(",")]
    return ",".join(sorted(set(keys)))


def load_output(output_path: str) -> tuple:
    """Load file output đã có. Trả về (list, dict_by_id)."""
    if not os.path.exists(output_path):
        return [], {}
    try:
        with open(output_path, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if content:
                rows = json.loads(content)
                by_id = {str(r["id"]): r for r in rows}
                return rows, by_id
    except Exception as e:
        print(f"⚠️ Lỗi load output: {e}")
    return [], {}


def save_output(output_path: str, rows: list):
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)


def question_to_base_row(q: dict) -> dict:
    return {
        # === Core (snake_case — chuẩn DB & frontend mới) ===
        "id":               q["id"],
        "question_en":      q["question"],
        "options":          q["options"],
        "correct":          q["correct"],           # đáp án gốc từ file
        "correct_verified": None,                   # Đáp án chính xác nhất sau khi bạn đã phân tích kỹ (ví dụ: "A" hoặc "A,C"). Tuyệt đối KHÔNG trả về "X". Nếu bạn phân vân, hãy thực hiện phân tích Chain-of-Thought (suy luận từng bước) trong đầu để chọn ra đáp án đúng nhất dựa trên tài liệu chuẩn của Salesforce. Bạn phải chịu trách nhiệm về tính chính xác của đáp án này.
        "answer_changed":   None,                   # true nếu bạn chọn đáp án khác với correct gốc, false nếu giống.
        "is_multi":         bool(q.get("isMulti", False)),

        "question_vi":      None,                   # AI sẽ dịch (giữ thuật ngữ English)
        "options_vi":       None,                   # AI sẽ dịch (giữ thuật ngữ English)
        "ai_expert":        None,                   # Điền sau khi chạy pipeline
    }


def log_correction(q: dict, original: str, verified: str, note: str):
    """Ghi log các câu bị sửa đáp án."""
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"\n{'='*60}\n")
        f.write(f"Câu #{q['id']}: {q['question'][:80]}...\n")
        f.write(f"File: {original}  →  AI: {verified}\n")
        f.write(f"Ghi chú: {note}\n")
        for k, v in sorted(q["options"].items()):
            f.write(f"  {k}. {v}\n")


def main():
    print("=" * 60)
    print("🚀  AI Expert Pipeline v3 — Verify + Explain")
    print("    AI xác minh đáp án trước khi giải thích")
    print("=" * 60)

    # 1. Load input
    if not os.path.exists(INPUT_JSON):
        print(f"❌ Không tìm thấy: {INPUT_JSON}")
        exit(1)

    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        exam_data = json.load(f)

    questions = exam_data.get("questions", [])
    total = len(questions)
    print(f"📄 Tổng câu hỏi: {total}")

    # 2. Load output đã có (resume)
    results, results_by_id = load_output(OUTPUT_JSON)
    already_done = len([r for r in results if r.get("ai_expert")])
    print(f"✅ Đã xử lý: {already_done} câu")

    remaining = [
        q for q in questions
        if str(q["id"]) not in results_by_id
        or results_by_id[str(q["id"])].get("ai_expert") is None
        or results_by_id[str(q["id"])].get("question_vi") is None
    ]
    print(f"⏳ Cần xử lý: {len(remaining)} câu")
    print(f"💰 Ước tính: ~¥{len(remaining) * COST_PER_ITEM_YEN:.0f}")

    # Đảm bảo tất cả câu đều có row cơ bản
    for q in questions:
        qid = str(q["id"])
        if qid not in results_by_id:
            row = question_to_base_row(q)
            results.append(row)
            results_by_id[qid] = row

    if not remaining:
        print("\n🎉 Tất cả câu đã xử lý xong!")
        save_output(OUTPUT_JSON, sorted(results, key=lambda r: r["id"]))
        return

    print("-" * 60)

    # 3. Clear log file cho session này
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            f.write("=== Answer Correction Log ===\n")

    success_count   = 0
    skip_count      = 0
    correction_count = 0

    try:
        for q in remaining:
            qid = str(q["id"])
            pos = already_done + success_count + 1
            print(f"\n➤ [{pos}/{total}] Câu #{q['id']}: {q['question'][:55]}...")
            print(f"   File đáp án: {q['correct']}", end="")

            result = call_gemini(q)

            if result == "QUOTA_EXHAUSTED":
                print("\n🛑 Hết quota. Dữ liệu đã lưu an toàn.")
                break

            if result is None:
                skip_count += 1
                print(f"\n  ⏭️ Bỏ qua câu #{q['id']} — sẽ thử lần sau.")
                continue

            # Chuẩn hóa đáp án
            confidence = result.get("confidence", "medium")
            verified_raw = result.get("verified_correct", q["correct"])
            original = normalize_correct(q["correct"])

            # Chỉ chấp nhận sửa nếu AI HIGH confidence
            if confidence == "high":
                verified = normalize_correct(verified_raw)
            else:
                verified = original  # Giữ nguyên nếu không chắc

            changed = (verified != original)

            if changed:
                correction_count += 1
                print(f" → AI sửa: {verified} ⚠️ (conf={confidence})")
                note = result.get("correction_note", "")
                log_correction(q, original, verified, note)
            else:
                conf_tag = f" (conf={confidence})" if confidence != "high" else ""
                print(f" → AI xác nhận ✅{conf_tag}")

            # Cập nhật row
            row = results_by_id[qid]
            row["correct_verified"] = verified
            row["answer_changed"]   = changed
            row["question_vi"]      = result.get("question_vi", row.get("question_vi"))
            row["options_vi"]       = result.get("options_vi", row.get("options_vi"))
            row["ai_expert"]        = result.get("analysis", "")

            success_count += 1
            cost = success_count * COST_PER_ITEM_YEN
            print(f"  ✅ Xong ({success_count} câu | ~¥{cost:.1f})")

            # Auto-save sau mỗi câu
            save_output(OUTPUT_JSON, sorted(results, key=lambda r: r["id"]))

            if cost >= MAX_COST_YEN:
                print(f"\n🚨 Đạt giới hạn ¥{MAX_COST_YEN}! Dừng.")
                break

            time.sleep(0.5)

    except KeyboardInterrupt:
        print("\n\n🛑 Dừng thủ công. Dữ liệu đã lưu.")
    except Exception as e:
        print(f"\n⚠️ Lỗi: {e}")
        save_output(OUTPUT_JSON, sorted(results, key=lambda r: r["id"]))

    # 4. Summary
    total_with_ai = len([r for r in results if r.get("ai_expert")])
    print(f"\n{'=' * 60}")
    print(f"📊 Kết quả phiên này:")
    print(f"   ✅ Thành công:   {success_count} câu")
    print(f"   ⚠️  AI sửa đáp án: {correction_count} câu (xem: {LOG_FILE})")
    print(f"   ⏭️  Bỏ qua:      {skip_count} câu")
    print(f"   🧠 Tổng có AI:  {total_with_ai} / {total} câu")
    print(f"   💾 Output: {OUTPUT_JSON}")
    print(f"{'=' * 60}")

    if total_with_ai == total:
        print(f"\n🎉 HOÀN TẤT! {correction_count} câu được AI sửa đáp án.")
        print(f"   → Review corrections: {LOG_FILE}")
        print(f"   → Import DB: python3 import_to_supabase.py")


if __name__ == "__main__":
    main()
