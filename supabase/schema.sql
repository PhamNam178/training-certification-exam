-- ================================================================
-- SUSHI LUYỆN ĐỀ THI — Database Schema (Supabase / PostgreSQL)
-- Hỗ trợ: Nhiều chứng chỉ | Multi-choice | AI Expert Analysis
--
-- Thống kê từ PD1 thực tế:
--   - Tối đa 5 đáp án / câu (A-E), sử dụng JSONB → không giới hạn
--   - Single choice: 376 câu | Multi-choice: 157 câu
--   - Max 3 đáp án đúng trong 1 câu multi-select
-- ================================================================

-- ----------------------------------------------------------------
-- 1. CERTIFICATIONS — Danh sách chứng chỉ
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certifications (
  id            TEXT PRIMARY KEY,        -- "pd1", "adm201", "pd2", "crt"
  name          TEXT NOT NULL,           -- "Platform Developer I"
  short_name    TEXT,                    -- "PD1"
  vendor        TEXT DEFAULT 'Salesforce',
  description   TEXT,                   -- mô tả ngắn về chứng chỉ
  exam_size     INT  DEFAULT 65,         -- số câu trong bài thi thật
  time_limit    INT  DEFAULT 105,        -- phút
  pass_score    INT  DEFAULT 65,         -- % để pass
  total_questions INT,                  -- tổng câu trong ngân hàng
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data ban đầu
INSERT INTO certifications (id, name, short_name, exam_size, time_limit, pass_score)
VALUES ('pd1', 'Platform Developer I', 'PD1', 65, 105, 65)
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------
-- 2. QUESTIONS — Ngân hàng câu hỏi (chung cho tất cả chứng chỉ)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
  id            SERIAL PRIMARY KEY,
  cert_id       TEXT NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  question_no   INT  NOT NULL,           -- số thứ tự gốc trong file (1, 2, 3...)

  -- === NỘI DUNG TIẾNG ANH (bắt buộc) ===
  question_en   TEXT NOT NULL,           -- câu hỏi tiếng Anh

  -- options: JSONB, không giới hạn số đáp án
  -- Format: {"A": "text...", "B": "text...", "C": "text...", "D": "text...", "E": "text..."}
  -- Thực tế PD1: tối đa 5 đáp án (A-E), nhưng JSONB cho phép mở rộng bất kỳ
  options       JSONB NOT NULL,

  -- correct: "A" (single) hoặc "A,C" hoặc "A,B,C" (multi-select)
  correct       TEXT NOT NULL,
  is_multi      BOOLEAN DEFAULT FALSE,   -- TRUE nếu có nhiều đáp án đúng
  explanation   TEXT,                   -- giải thích đáp án gốc (tiếng Việt từ file)

  -- === BẢN DỊCH TIẾNG VIỆT (optional, dùng cho hint) ===
  question_vi   TEXT,                   -- dịch câu hỏi
  options_vi    JSONB,                  -- {"A": "...", "B": "..."} — dịch đáp án

  -- === AI EXPERT ANALYSIS (từ pipeline enrich_expert.py) ===
  -- Markdown text gồm: 📝 Dịch câu hỏi | 📋 Dịch đáp án | 💡 Mẹo chọn đáp án
  ai_expert          TEXT,
  ai_expert_updated_at TIMESTAMPTZ,

  -- === METADATA / PHÂN LOẠI (mở rộng sau) ===
  topic         TEXT,                   -- "Apex", "SOQL", "Security", "Visualforce"...
  difficulty    TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  tags          TEXT[],                 -- ["governor-limits", "best-practice"]

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(cert_id, question_no)          -- mỗi cert không được trùng số câu
);

-- Index cho query thường dùng
CREATE INDEX IF NOT EXISTS idx_questions_cert_id   ON questions(cert_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic      ON questions(topic);
CREATE INDEX IF NOT EXISTS idx_questions_is_multi   ON questions(is_multi);
CREATE INDEX IF NOT EXISTS idx_questions_ai_expert  ON questions((ai_expert IS NOT NULL));


-- ----------------------------------------------------------------
-- 3. EXAM_SESSIONS — Lịch sử mỗi lần thi (cho sau này)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cert_id       TEXT REFERENCES certifications(id),
  mode          TEXT NOT NULL CHECK (mode IN ('demo', 'full', 'practice')),

  -- Danh sách câu hỏi theo thứ tự (random cho demo/full, ordered cho practice)
  question_ids  INT[] NOT NULL,

  -- Kết quả (chỉ có sau khi submit)
  score         INT,                    -- % score (0-100)
  correct_count INT,
  total_count   INT,
  time_used     INT,                    -- giây
  passed        BOOLEAN,

  started_at    TIMESTAMPTZ DEFAULT NOW(),
  submitted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON exam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_cert_id ON exam_sessions(cert_id);


-- ----------------------------------------------------------------
-- 4. USER_ANSWERS — Đáp án của từng câu trong mỗi phiên thi
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_answers (
  id            SERIAL PRIMARY KEY,
  session_id    UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  question_id   INT  NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  cert_id       TEXT,

  -- Đáp án người dùng chọn: "A" hoặc "A,C" (multi-select)
  selected      TEXT,
  is_correct    BOOLEAN,
  answered_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_answers_session_id   ON user_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id  ON user_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_id      ON user_answers(user_id);


-- ----------------------------------------------------------------
-- 5. LEADERBOARD — Điểm cao nhất (giống Firebase hiện tại)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leaderboard (
  id            SERIAL PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id    UUID REFERENCES exam_sessions(id) ON DELETE SET NULL,
  username      TEXT,
  cert_id       TEXT REFERENCES certifications(id),
  mode          TEXT DEFAULT 'full',
  score         INT NOT NULL,
  correct       INT,
  total         INT,
  time_used     INT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_cert_id ON leaderboard(cert_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score   ON leaderboard(score DESC);


-- ----------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------
ALTER TABLE certifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_answers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard      ENABLE ROW LEVEL SECURITY;

-- Certifications & Questions: PUBLIC READ (không cần đăng nhập để đọc)
CREATE POLICY "Public read certifications"
  ON certifications FOR SELECT USING (true);

CREATE POLICY "Public read questions"
  ON questions FOR SELECT USING (true);

CREATE POLICY "Public read leaderboard"
  ON leaderboard FOR SELECT USING (true);

-- Exam sessions: Chỉ chủ sở hữu mới đọc/ghi được
CREATE POLICY "Users own sessions"
  ON exam_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own answers"
  ON user_answers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Leaderboard: Ai cũng đọc được, chỉ user của mình mới insert được
CREATE POLICY "Users insert own leaderboard"
  ON leaderboard FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ----------------------------------------------------------------
-- 7. TRIGGER: tự update updated_at khi sửa questions
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ----------------------------------------------------------------
-- 8. VIEW hữu ích: Thống kê câu hỏi theo cert
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW cert_stats AS
SELECT
  c.id,
  c.name,
  c.short_name,
  c.exam_size,
  c.pass_score,
  COUNT(q.id)                          AS total_questions,
  COUNT(q.id) FILTER (WHERE q.is_multi)         AS multi_choice_count,
  COUNT(q.id) FILTER (WHERE NOT q.is_multi)     AS single_choice_count,
  COUNT(q.id) FILTER (WHERE q.ai_expert IS NOT NULL) AS ai_expert_count,
  COUNT(q.id) FILTER (WHERE q.ai_expert IS NULL)     AS ai_expert_pending,
  COUNT(q.id) FILTER (WHERE q.topic IS NOT NULL)     AS with_topic_count
FROM certifications c
LEFT JOIN questions q ON q.cert_id = c.id
GROUP BY c.id, c.name, c.short_name, c.exam_size, c.pass_score;
