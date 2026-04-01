// ============================================
// SALESFORCE EXAM PRACTICE - MAIN APP
// ============================================

let state = {
  screen: 'home',       // home | mode | exam | results
  lang: 'vi',           // vi | en
  certData: null,       // loaded JSON
  certId: 'pd1',
  mode: null,            // demo | full
  questions: [],         // current exam questions
  currentIndex: 0,
  answers: {},            // { questionIndex: ['A','B'] }
  timer: 0,
  timerInterval: null,
  submitted: false
};

const app = document.getElementById('app');

// ========== DATA ==========
async function loadCert(certId) {
  const res = await fetch(`/data/${certId}.json`);
  state.certData = await res.json();
  return state.certData;
}

// ========== RENDERING ==========
function render() {
  switch (state.screen) {
    case 'home': renderHome(); break;
    case 'mode': renderModeSelect(); break;
    case 'exam': renderExam(); break;
    case 'results': renderResults(); break;
  }
}

function renderHome() {
  app.innerHTML = `
    ${renderNavbar()}
    <section class="hero">
      <div class="hero__content fade-in">
        <div class="hero__badge">✨ Miễn phí 100% • Không cần đăng ký</div>
        <h1>Luyện Thi Chứng Chỉ<br/><span>Salesforce</span></h1>
        <p class="hero__subtitle">Hệ thống ôn thi trắc nghiệm với hơn 500 câu hỏi chuẩn, hỗ trợ song ngữ Anh - Việt, chấm điểm tự động và giải thích chi tiết từng câu.</p>
      </div>
    </section>
    <div class="cert-grid">
      <div class="cert-card fade-in" onclick="selectCert('pd1')">
        <div class="cert-card__icon">⚡</div>
        <div class="cert-card__title">Platform Developer I</div>
        <div class="cert-card__info">Chứng chỉ dành cho lập trình viên Salesforce. Bao gồm Apex, SOQL, LWC, Triggers và nhiều chủ đề khác.</div>
        <div class="cert-card__stats">
          <span>📚 533 câu hỏi</span>
          <span>⏱️ 105 phút</span>
          <span>🎯 65% để đạt</span>
        </div>
      </div>
      <div class="cert-card fade-in" style="opacity:0.5; pointer-events:none;">
        <div class="cert-card__icon">🛡️</div>
        <div class="cert-card__title">Administrator</div>
        <div class="cert-card__info">Chứng chỉ quản trị viên Salesforce. Sắp ra mắt!</div>
        <div class="cert-card__stats">
          <span>🔜 Coming Soon</span>
        </div>
      </div>
      <div class="cert-card fade-in" style="opacity:0.5; pointer-events:none;">
        <div class="cert-card__icon">🏗️</div>
        <div class="cert-card__title">App Builder</div>
        <div class="cert-card__info">Chứng chỉ xây dựng ứng dụng trên nền tảng Salesforce. Sắp ra mắt!</div>
        <div class="cert-card__stats">
          <span>🔜 Coming Soon</span>
        </div>
      </div>
    </div>
    ${renderFooter()}
  `;
}

function renderModeSelect() {
  const cert = state.certData;
  app.innerHTML = `
    ${renderNavbar()}
    <div class="mode-selection fade-in">
      <h2>🎓 ${cert.certification}</h2>
      <p style="color:var(--gray-500);margin-bottom:24px;">Chọn chế độ luyện thi phù hợp với bạn</p>
      <div class="mode-cards">
        <div class="mode-card ${state.mode === 'demo' ? 'selected' : ''}" onclick="selectMode('demo')">
          <div class="mode-card__title">🚀 Demo nhanh (5 câu)</div>
          <div class="mode-card__desc">Trải nghiệm nhanh hệ thống thi. Không giới hạn thời gian.</div>
        </div>
        <div class="mode-card ${state.mode === 'full' ? 'selected' : ''}" onclick="selectMode('full')">
          <div class="mode-card__title">📝 Thi thật (65 câu - 105 phút)</div>
          <div class="mode-card__desc">Mô phỏng 100% bài thi thật. Random 65 câu, đếm ngược 105 phút.</div>
        </div>
        <div class="mode-card ${state.mode === 'practice' ? 'selected' : ''}" onclick="selectMode('practice')">
          <div class="mode-card__title">📖 Ôn tập (Tất cả ${cert.totalQuestions} câu)</div>
          <div class="mode-card__desc">Làm toàn bộ ${cert.totalQuestions} câu hỏi. Không giới hạn thời gian, xem đáp án ngay sau mỗi câu.</div>
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-top:32px;">
        <button class="btn btn--ghost" onclick="goHome()">← Quay lại</button>
        <button class="btn btn--primary" onclick="startExam()" ${!state.mode ? 'disabled' : ''}>Bắt đầu thi →</button>
      </div>
    </div>
    ${renderFooter()}
  `;
}

function renderExam() {
  const q = state.questions[state.currentIndex];
  const questionText = q.question; // Always English
  const total = state.questions.length;
  const progress = ((state.currentIndex + 1) / total) * 100;
  const selectedAnswers = state.answers[state.currentIndex] || [];

  // Format question text with code blocks
  const formattedQuestion = formatCodeInText(questionText);

  // Timer display
  let timerHTML = '';
  if (state.mode === 'full') {
    const mins = Math.floor(state.timer / 60);
    const secs = state.timer % 60;
    const timerClass = state.timer < 300 ? 'danger' : state.timer < 600 ? 'warning' : '';
    timerHTML = `<div class="exam-timer ${timerClass}">⏱️ ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}</div>`;
  }

  // Multi-select hint
  const multiHint = q.isMulti ? `<div class="multi-hint">✎ Select multiple answers</div>` : '';

  // Build options
  const optKeys = Object.keys(q.options);
  const optionsHTML = optKeys.map(key => {
    const optText = q.options[key]; // Always English
    const isSelected = selectedAnswers.includes(key);
    
    let optClass = isSelected ? 'selected' : '';
    let markerContent = key;
    
    // In practice mode, show correct/incorrect after answering
    if (state.mode === 'practice' && state.practiceRevealed && state.practiceRevealed[state.currentIndex]) {
      const correctArr = q.correct.split(',').map(s => s.trim());
      if (correctArr.includes(key)) {
        optClass = 'correct';
        markerContent = '✓';
      } else if (isSelected) {
        optClass = 'incorrect';
        markerContent = '✗';
      }
    }

    return `
      <div class="option-item ${optClass}" onclick="selectOption('${key}')">
        <div class="option-item__marker">${markerContent}</div>
        <div class="option-item__text">${key}. ${optText}</div>
      </div>
    `;
  }).join('');

  // Explanation - show when hint is toggled (any mode) or practice revealed
  const isHintShown = state.hintShown && state.hintShown[state.currentIndex];
  const isPracticeRevealed = state.mode === 'practice' && state.practiceRevealed && state.practiceRevealed[state.currentIndex];
  
  let explanationHTML = '';
  if (isHintShown || isPracticeRevealed) {
    // Build Vietnamese translation section
    const viQuestion = q.questionVI && q.questionVI !== q.question ? q.questionVI : '';
    const viOptions = Object.keys(q.optionsVI || {}).map(key => {
      const viOpt = q.optionsVI[key];
      if (viOpt && viOpt !== q.options[key]) {
        return `<div style="padding:4px 0;">${key}. ${viOpt}</div>`;
      }
      return '';
    }).filter(Boolean).join('');

    let viTranslation = '';
    if (viQuestion || viOptions) {
      viTranslation = `
        <div style="margin-bottom:16px;padding:16px;background:rgba(1,118,211,0.03);border-radius:8px;border:1px dashed var(--gray-300);">
          <h4 style="font-size:13px;font-weight:600;color:var(--sf-blue);margin-bottom:8px;">🇻🇳 Bản dịch tiếng Việt</h4>
          ${viQuestion ? `<p style="font-size:14px;line-height:1.6;color:var(--gray-700);margin-bottom:8px;">${viQuestion}</p>` : ''}
          ${viOptions ? `<div style="font-size:13px;color:var(--gray-600);line-height:1.6;">${viOptions}</div>` : ''}
        </div>
      `;
    }

    const expText = cleanExplanation(q.explanation);
    
    // Correct answer in English
    const correctArr = q.correct.split(',').map(s => s.trim());
    const correctAnswerText = correctArr.map(key => `<div style="padding:3px 0;"><strong style="color:var(--sf-success);">${key}.</strong> ${q.options[key] || ''}</div>`).join('');
    const correctAnswerHTML = `
      <div style="margin-bottom:12px;padding:12px 16px;background:rgba(46,132,74,0.06);border-radius:8px;border:1px solid rgba(46,132,74,0.2);">
        <div style="font-size:13px;font-weight:600;color:var(--sf-success);margin-bottom:6px;">✅ Correct Answer:</div>
        <div style="font-size:13px;color:var(--gray-700);">${correctAnswerText}</div>
      </div>
    `;

    explanationHTML = `
      <div class="explanation-box fade-in">
        ${correctAnswerHTML}
        ${viTranslation}
        ${expText ? `<h4>💡 Giải thích</h4><p>${expText}</p>` : ''}
      </div>
    `;
  }

  // Question navigator dots
  const dotsHTML = state.questions.map((_, i) => {
    let dotClass = '';
    if (i === state.currentIndex) dotClass = 'current';
    else if (state.answers[i] && state.answers[i].length > 0) dotClass = 'answered';
    return `<div class="q-dot ${dotClass}" onclick="goToQuestion(${i})">${i + 1}</div>`;
  }).join('');

  // Practice mode: check button
  let practiceBtn = '';
  if (state.mode === 'practice' && (!state.practiceRevealed || !state.practiceRevealed[state.currentIndex])) {
    practiceBtn = `<button class="btn btn--success" onclick="revealAnswer()" ${selectedAnswers.length === 0 ? 'disabled' : ''}>Kiểm tra đáp án</button>`;
  }

  // Hint toggle button (all modes)
  const hintBtnLabel = isHintShown ? 'Ẩn gợi ý' : '💡 Gợi ý';
  const hintBtn = `<button class="btn btn--ghost" onclick="toggleHint()" style="margin-left:8px;">${hintBtnLabel}</button>`;

  app.innerHTML = `
    ${renderNavbar()}
    <div class="exam-container">
      <div class="exam-header">
        <div class="exam-header__left">
          <span class="exam-header__counter">Câu ${state.currentIndex + 1} / ${total}</span>
        </div>
        ${timerHTML}
      </div>
      <div class="progress-bar">
        <div class="progress-bar__fill" style="width:${progress}%"></div>
      </div>
      <div class="question-card">
        <div class="question-card__body">
          ${multiHint}
          <div class="question-text">${formattedQuestion}</div>
          <div class="options-list">
            ${optionsHTML}
          </div>
          ${explanationHTML}
        </div>
      </div>
      <div class="exam-nav">
        <div class="exam-nav__left">
          <button class="btn btn--ghost" onclick="prevQuestion()" ${state.currentIndex === 0 ? 'disabled' : ''}>← Trước</button>
          ${practiceBtn}
          ${hintBtn}
        </div>
        <div class="exam-nav__right">
          ${state.currentIndex < total - 1 
            ? `<button class="btn btn--primary" onclick="nextQuestion()">Tiếp →</button>`
            : (state.mode !== 'practice' 
              ? `<button class="btn btn--success" onclick="submitExam()">Nộp bài ✓</button>`
              : `<button class="btn btn--success" onclick="submitExam()">Hoàn thành ✓</button>`)
          }
        </div>
      </div>
      <div class="question-nav-grid" style="margin-top:20px;">
        ${dotsHTML}
      </div>
    </div>
  `;
}

function renderResults() {
  const total = state.questions.length;
  let correct = 0;
  
  const reviewHTML = state.questions.map((q, i) => {
    const selected = state.answers[i] || [];
    const correctArr = q.correct.split(',').map(s => s.trim());
    const isCorrect = selected.length === correctArr.length && selected.every(a => correctArr.includes(a));
    if (isCorrect) correct++;

    const qText = q.question; // Always English

    const optKeys = Object.keys(q.options);
    const optionsReview = optKeys.map(key => {
      const optText = q.options[key]; // Always English
      let cls = '';
      if (correctArr.includes(key)) cls = 'correct';
      else if (selected.includes(key)) cls = 'incorrect';
      let marker = key;
      if (correctArr.includes(key)) marker = '✓';
      else if (selected.includes(key)) marker = '✗';
      return `<div class="option-item ${cls}" style="cursor:default;padding:10px 14px;font-size:14px;">
        <div class="option-item__marker" style="width:24px;height:24px;font-size:11px;">${marker}</div>
        <div class="option-item__text">${key}. ${optText}</div>
      </div>`;
    }).join('');

    // Vietnamese translation for review
    const viQ = q.questionVI && q.questionVI !== q.question ? q.questionVI : '';
    const viOpts = Object.keys(q.optionsVI || {}).map(key => {
      const v = q.optionsVI[key];
      return v && v !== q.options[key] ? `<div style="padding:2px 0;">${key}. ${v}</div>` : '';
    }).filter(Boolean).join('');

    let hintHTML = '';
    if (viQ || viOpts || q.explanation) {
      const viBlock = (viQ || viOpts) ? `
        <div style="margin-bottom:12px;padding:12px;background:rgba(1,118,211,0.03);border-radius:8px;border:1px dashed var(--gray-300);">
          <h4 style="font-size:12px;font-weight:600;color:var(--sf-blue);margin-bottom:6px;">🇻🇳 Bản dịch tiếng Việt</h4>
          ${viQ ? `<p style="font-size:13px;line-height:1.5;color:var(--gray-700);margin-bottom:6px;">${viQ}</p>` : ''}
          ${viOpts ? `<div style="font-size:12px;color:var(--gray-600);line-height:1.5;">${viOpts}</div>` : ''}
        </div>` : '';
      hintHTML = `<div class="explanation-box">${viBlock}${q.explanation ? `<h4>💡 Giải thích</h4><p>${cleanExplanation(q.explanation)}</p>` : ''}</div>`;
    }

    return `
      <div class="question-card fade-in" style="margin-bottom:16px;">
        <div class="question-card__body" style="padding:24px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="font-size:13px;font-weight:600;color:${isCorrect ? 'var(--sf-success)' : 'var(--sf-error)'};">
              ${isCorrect ? '✅ Correct' : '❌ Incorrect'} — Question ${i + 1}
            </span>
          </div>
          <div class="question-text" style="font-size:14px;margin-bottom:16px;">${formatCodeInText(qText)}</div>
          <div class="options-list" style="gap:6px;">
            ${optionsReview}
          </div>
          ${hintHTML}
        </div>
      </div>
    `;
  }).join('');

  const score = Math.round((correct / total) * 100);
  const passed = score >= (state.certData.passingScore || 65);

  // Dots
  const dotsHTML = state.questions.map((q, i) => {
    const selected = state.answers[i] || [];
    const correctArr = q.correct.split(',').map(s => s.trim());
    const isCorrect = selected.length === correctArr.length && selected.every(a => correctArr.includes(a));
    return `<div class="q-dot ${isCorrect ? 'correct-dot' : 'incorrect-dot'}" onclick="document.getElementById('review-q-${i}').scrollIntoView({behavior:'smooth'})">${i + 1}</div>`;
  }).join('');

  app.innerHTML = `
    ${renderNavbar()}
    <div class="results-container">
      <div class="results-hero fade-in">
        <div class="results-hero__icon ${passed ? 'pass' : 'fail'}">${passed ? '🎉' : '📚'}</div>
        <h2 class="${passed ? 'pass' : 'fail'}">${passed ? 'Chúc mừng — Bạn đã ĐẠT!' : 'Chưa đạt — Cố gắng thêm!'}</h2>
        <div class="results-score">${score}%</div>
        <div class="results-stats">
          <div class="results-stat">
            <div class="results-stat__value" style="color:var(--sf-success)">${correct}</div>
            <div class="results-stat__label">Đúng</div>
          </div>
          <div class="results-stat">
            <div class="results-stat__value" style="color:var(--sf-error)">${total - correct}</div>
            <div class="results-stat__label">Sai</div>
          </div>
          <div class="results-stat">
            <div class="results-stat__value">${total}</div>
            <div class="results-stat__label">Tổng câu</div>
          </div>
        </div>
        <div class="results-actions">
          <button class="btn btn--primary" onclick="goHome()">🏠 Trang chủ</button>
          <button class="btn btn--secondary" onclick="retryExam()">🔄 Thi lại</button>
        </div>
      </div>
      <h3 style="font-size:20px;font-weight:700;margin-bottom:16px;">📋 Tổng quan</h3>
      <div class="question-nav-grid" style="margin-bottom:24px;">
        ${dotsHTML}
      </div>
      <h3 style="font-size:20px;font-weight:700;margin-bottom:16px;">📝 Chi tiết từng câu</h3>
      ${reviewHTML}
    </div>
    ${renderFooter()}
  `;
}

function renderNavbar() {
  return `
    <nav class="navbar">
      <a class="navbar__logo" onclick="goHome()">
        <div class="navbar__logo-icon">☁️</div>
        SF Exam Practice
      </a>
    </nav>
  `;
}

function renderFooter() {
  return `<footer class="footer">© 2026 Salesforce Certification Exam Practice — Built with ❤️</footer>`;
}

// ========== FORMATTERS ==========
function cleanExplanation(text) {
  if (!text) return '';
  // Remove duplicate prefix "💡 Giải thích:" or "💡 Giải thích:\n" since we show it as title
  return text.replace(/^💡\s*Giải thích\s*:\s*\n?/i, '').trim();
}

function formatCodeInText(text) {
  if (!text) return '';
  
  // Detect code patterns
  if (text.includes('List<') || text.includes('Map<') || text.includes('Set<') || 
      text.includes('[SELECT') || text.includes('for(') || text.includes('for (') || 
      text.match(/\{[^}]*\}/)) {
    
    // Find the last '?' which separates question from code
    const lastQ = text.lastIndexOf('?');
    if (lastQ !== -1 && lastQ < text.length - 5) {
      const intro = text.substring(0, lastQ + 1);
      let codePart = text.substring(lastQ + 1).trim();
      
      if (codePart.length > 20) {
        // Format code
        codePart = codePart.replace(/;/g, ';\n');
        codePart = codePart.replace(/\{\s*/g, ' {\n  ');
        codePart = codePart.replace(/\s*\}/g, '\n}');
        codePart = codePart.replace(/\n\s*\n/g, '\n');
        
        return `${intro}<pre>${escapeHtml(codePart.trim())}</pre>`;
      }
    }
  }
  
  return text;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ========== ACTIONS ==========
window.selectCert = async function(certId) {
  state.certId = certId;
  await loadCert(certId);
  state.screen = 'mode';
  state.mode = null;
  render();
}

window.selectMode = function(mode) {
  state.mode = mode;
  render();
}

window.goHome = function() {
  clearInterval(state.timerInterval);
  state.screen = 'home';
  state.mode = null;
  state.submitted = false;
  render();
}

window.startExam = function() {
  const data = state.certData;
  let questions = [...data.questions];
  
  // Shuffle
  questions = questions.sort(() => Math.random() - 0.5);
  
  if (state.mode === 'demo') {
    questions = questions.slice(0, 5);
  } else if (state.mode === 'full') {
    questions = questions.slice(0, data.examSize || 65);
  }
  // practice = all questions

  state.questions = questions;
  state.currentIndex = 0;
  state.answers = {};
  state.submitted = false;
  state.practiceRevealed = {};

  // Timer for full mode
  if (state.mode === 'full') {
    state.timer = (data.timeLimit || 105) * 60;
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      state.timer--;
      if (state.timer <= 0) {
        clearInterval(state.timerInterval);
        submitExam();
        return;
      }
      // Update timer display only
      const timerEl = document.querySelector('.exam-timer');
      if (timerEl) {
        const mins = Math.floor(state.timer / 60);
        const secs = state.timer % 60;
        timerEl.textContent = `⏱️ ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        timerEl.className = `exam-timer ${state.timer < 300 ? 'danger' : state.timer < 600 ? 'warning' : ''}`;
      }
    }, 1000);
  }

  state.screen = 'exam';
  render();
}

// Partial update: only refresh options + nav buttons without full page re-render
function updateExamPartial() {
  const q = state.questions[state.currentIndex];
  const selectedAnswers = state.answers[state.currentIndex] || [];
  const isHintShown = state.hintShown && state.hintShown[state.currentIndex];
  const isPracticeRevealed = state.mode === 'practice' && state.practiceRevealed && state.practiceRevealed[state.currentIndex];

  // Update options
  const optionsList = document.querySelector('.options-list');
  if (optionsList) {
    const optKeys = Object.keys(q.options);
    optionsList.innerHTML = optKeys.map(key => {
      const optText = q.options[key];
      const isSelected = selectedAnswers.includes(key);
      let optClass = isSelected ? 'selected' : '';
      let markerContent = key;
      if (isPracticeRevealed) {
        const correctArr = q.correct.split(',').map(s => s.trim());
        if (correctArr.includes(key)) { optClass = 'correct'; markerContent = '✓'; }
        else if (isSelected) { optClass = 'incorrect'; markerContent = '✗'; }
      }
      return `<div class="option-item ${optClass}" onclick="selectOption('${key}')">
        <div class="option-item__marker">${markerContent}</div>
        <div class="option-item__text">${key}. ${optText}</div>
      </div>`;
    }).join('');
  }

  // Update explanation area
  let oldExp = document.querySelector('.explanation-box');
  if (oldExp) oldExp.remove();

  if (isHintShown || isPracticeRevealed) {
    const viQuestion = q.questionVI && q.questionVI !== q.question ? q.questionVI : '';
    const viOptions = Object.keys(q.optionsVI || {}).map(key => {
      const viOpt = q.optionsVI[key];
      return (viOpt && viOpt !== q.options[key]) ? `<div style="padding:4px 0;">${key}. ${viOpt}</div>` : '';
    }).filter(Boolean).join('');

    let viTranslation = '';
    if (viQuestion || viOptions) {
      viTranslation = `<div style="margin-bottom:16px;padding:16px;background:rgba(1,118,211,0.03);border-radius:8px;border:1px dashed var(--gray-300);">
        <h4 style="font-size:13px;font-weight:600;color:var(--sf-blue);margin-bottom:8px;">🇻🇳 Bản dịch tiếng Việt</h4>
        ${viQuestion ? `<p style="font-size:14px;line-height:1.6;color:var(--gray-700);margin-bottom:8px;">${viQuestion}</p>` : ''}
        ${viOptions ? `<div style="font-size:13px;color:var(--gray-600);line-height:1.6;">${viOptions}</div>` : ''}
      </div>`;
    }

    const correctArr = q.correct.split(',').map(s => s.trim());
    const correctAnswerText = correctArr.map(key => `<div style="padding:3px 0;"><strong style="color:var(--sf-success);">${key}.</strong> ${q.options[key] || ''}</div>`).join('');
    const correctAnswerHTML = `<div style="margin-bottom:12px;padding:12px 16px;background:rgba(46,132,74,0.06);border-radius:8px;border:1px solid rgba(46,132,74,0.2);">
      <div style="font-size:13px;font-weight:600;color:var(--sf-success);margin-bottom:6px;">✅ Correct Answer:</div>
      <div style="font-size:13px;color:var(--gray-700);">${correctAnswerText}</div>
    </div>`;

    const expText = cleanExplanation(q.explanation);
    const expDiv = document.createElement('div');
    expDiv.className = 'explanation-box fade-in';
    expDiv.innerHTML = `${correctAnswerHTML}${viTranslation}${expText ? `<h4>💡 Giải thích</h4><p>${expText}</p>` : ''}`;
    document.querySelector('.question-card__body')?.appendChild(expDiv);
  }

  // Update nav buttons (practice check button state)
  const navLeft = document.querySelector('.exam-nav__left');
  if (navLeft) {
    let practiceBtn = '';
    if (state.mode === 'practice' && (!state.practiceRevealed || !state.practiceRevealed[state.currentIndex])) {
      practiceBtn = `<button class="btn btn--success" onclick="revealAnswer()" ${selectedAnswers.length === 0 ? 'disabled' : ''}>Kiểm tra đáp án</button>`;
    }
    const hintBtnLabel = isHintShown ? 'Ẩn gợi ý' : '💡 Gợi ý';
    const hintBtn = `<button class="btn btn--ghost" onclick="toggleHint()" style="margin-left:8px;">${hintBtnLabel}</button>`;
    navLeft.innerHTML = `<button class="btn btn--ghost" onclick="prevQuestion()" ${state.currentIndex === 0 ? 'disabled' : ''}>← Trước</button>${practiceBtn}${hintBtn}`;
  }

  // Update question navigator dots
  const dotsContainer = document.querySelector('.question-nav-grid');
  if (dotsContainer) {
    const dots = dotsContainer.querySelectorAll('.q-dot');
    dots.forEach((dot, i) => {
      dot.className = 'q-dot';
      if (i === state.currentIndex) dot.classList.add('current');
      else if (state.answers[i] && state.answers[i].length > 0) dot.classList.add('answered');
    });
  }
}

window.selectOption = function(key) {
  if (state.mode === 'practice' && state.practiceRevealed && state.practiceRevealed[state.currentIndex]) return;
  
  const q = state.questions[state.currentIndex];
  let current = state.answers[state.currentIndex] || [];

  if (q.isMulti) {
    if (current.includes(key)) {
      current = current.filter(k => k !== key);
    } else {
      current.push(key);
    }
  } else {
    current = [key];
  }

  state.answers[state.currentIndex] = current;
  updateExamPartial();
}

window.prevQuestion = function() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    render();
  }
}

window.nextQuestion = function() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex++;
    render();
  }
}

window.goToQuestion = function(i) {
  state.currentIndex = i;
  render();
}

window.revealAnswer = function() {
  if (!state.practiceRevealed) state.practiceRevealed = {};
  state.practiceRevealed[state.currentIndex] = true;
  if (!state.hintShown) state.hintShown = {};
  state.hintShown[state.currentIndex] = true;
  updateExamPartial();
}

window.toggleHint = function() {
  if (!state.hintShown) state.hintShown = {};
  state.hintShown[state.currentIndex] = !state.hintShown[state.currentIndex];
  updateExamPartial();
}

window.submitExam = function() {
  clearInterval(state.timerInterval);
  state.submitted = true;
  state.screen = 'results';
  render();
  window.scrollTo(0, 0);
}

window.retryExam = function() {
  state.screen = 'mode';
  render();
}

window.toggleLang = function() {
  state.lang = state.lang === 'vi' ? 'en' : 'vi';
  render();
}

// ========== INIT ==========
render();
