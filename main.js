// ============================================
// SALESFORCE EXAM PRACTICE - MAIN APP
// Connected to Salesforce Database via REST API
// ============================================
import { onAuthChange, loginWithGoogle, logout, getCurrentUser, getUserProfile, saveUserProfile, saveScore, getAllLeaderboard } from './firebase.js';
import { loadCertFromSalesforce } from './salesforce-api.js';
import { openAIExpertPopup } from './ai-expert.js';

let state = {
  screen: 'home',       // home | login | mode | exam | results | leaderboard
  lang: 'vi',           // vi | en
  certData: null,       // loaded from Salesforce DB or fallback JSON
  certId: 'pd1',
  dataSource: 'loading', // 'salesforce' | 'json' | 'loading'
  mode: null,            // demo | full | practice
  questions: [],         // current exam questions
  currentIndex: 0,
  answers: {},            // { questionIndex: ['A','B'] }
  timer: 0,
  timerInterval: null,
  timerStart: 0,         // timestamp when exam started
  submitted: false,
  // Auth
  user: null,            // Firebase user
  userProfile: null,     // { username, ... } from Firestore
  authLoading: true,
  showUsernamePopup: false
};

const app = document.getElementById('app');

// ========== DATA (Salesforce Database → Fallback JSON) ==========
async function loadCert(certId) {
  // Ưu tiên 1: Lấy data trực tiếp từ Salesforce Database qua REST API
  const sfData = await loadCertFromSalesforce(certId);
  if (sfData && sfData.questions && sfData.questions.length > 0) {
    state.certData = sfData;
    state.dataSource = 'salesforce';
    console.log(`🔗 Data source: SALESFORCE DATABASE (${sfData.totalQuestions} questions)`);
    return state.certData;
  }

  // Ưu tiên 2: Fallback về file JSON tĩnh nếu API không khả dụng
  console.log('📁 Data source: LOCAL JSON (fallback)');
  const res = await fetch(`/data/${certId}.json`);
  state.certData = await res.json();
  state.dataSource = 'json';
  return state.certData;
}

// ========== RENDERING ==========
function render() {
  switch (state.screen) {
    case 'home': renderHome(); break;
    case 'login': renderLogin(); break;
    case 'mode': renderModeSelect(); break;
    case 'exam': renderExam(); break;
    case 'results': renderResults(); break;
    case 'leaderboard': renderLeaderboard(); break;
  }
  // Show username popup if needed
  if (state.showUsernamePopup) renderUsernamePopup();
}

function renderHome() {
  app.innerHTML = `
    ${renderNavbar()}
    <section class="hero">
      <div class="hero__content fade-in">
        <div class="hero__badge">✨ Miễn phí 100% • ${state.user ? `Xin chào, ${state.userProfile?.username || 'User'}!` : 'Đăng nhập để lưu điểm'}</div>
        ${state.dataSource === 'salesforce' 
          ? '<div style="display:inline-block;background:linear-gradient(135deg,#04844b,#0b8953);color:#fff;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:600;margin-bottom:8px;letter-spacing:0.5px;">🔗 Live Database — Salesforce Connected</div>'
          : state.dataSource === 'json' 
            ? '<div style="display:inline-block;background:#ff6600;color:#fff;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:600;margin-bottom:8px;">📁 Offline Mode — Static JSON</div>'
            : ''}
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
    <div style="text-align:center;margin:32px 0;">
      <button class="btn btn--secondary" onclick="showLeaderboard()" style="font-size:16px;padding:14px 32px;">🏆 Bảng Xếp Hạng</button>
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
  const hintBtn = state.mode !== 'practice' ? `<button class="btn btn--ghost" onclick="toggleHint()" style="margin-left:8px;">${hintBtnLabel}</button>` : '';

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
          <button class="btn btn--ai" onclick="askAIExpert()" style="margin-left:8px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;font-weight:600;">🧠 Gợi ý từ chuyên gia</button>
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

    const skipped = selected.length === 0;
    return `
      <div class="question-card fade-in" style="margin-bottom:16px;" id="review-q-${i}">
        <div class="question-card__body" style="padding:24px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <span style="font-size:13px;font-weight:600;color:${isCorrect ? 'var(--sf-success)' : 'var(--sf-error)'};">
              ${isCorrect ? '✅ Correct' : '❌ Incorrect'} — Question ${i + 1}
            </span>
            ${skipped ? '<span style="font-size:12px;color:var(--gray-400);background:var(--gray-100);padding:2px 10px;border-radius:10px;">⚠️ Chưa trả lời</span>' : ''}
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
  let authHTML = '';
  if (state.authLoading) {
    authHTML = '<span style="font-size:13px;color:var(--gray-400);">...</span>';
  } else if (state.user) {
    const name = state.userProfile?.username || state.user.displayName || 'User';
    const avatar = state.user.photoURL ? `<img src="${state.user.photoURL}" style="width:28px;height:28px;border-radius:50%;margin-right:8px;"/>` : '👤 ';
    authHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:13px;color:#fff;display:flex;align-items:center;">${avatar}${name}</span>
        <button class="btn btn--ghost" onclick="doLogout()" style="font-size:12px;padding:4px 12px;color:#fff;border-color:rgba(255,255,255,0.3);">Đăng xuất</button>
      </div>
    `;
  } else {
    authHTML = `<button class="btn btn--primary" onclick="doLogin()" style="font-size:13px;padding:6px 16px;">🔵 Đăng nhập</button>`;
  }
  return `
    <nav class="navbar">
      <a class="navbar__logo" onclick="goHome()">
        <div class="navbar__logo-icon">☁️</div>
        SF Exam Practice
      </a>
      <div class="navbar__actions">${authHTML}</div>
    </nav>
  `;
}

function renderLogin() {
  app.innerHTML = `
    ${renderNavbar()}
    <div class="mode-selection fade-in" style="max-width:480px;text-align:center;">
      <div style="font-size:64px;margin-bottom:24px;">🔐</div>
      <h2 style="margin-bottom:8px;">Đăng nhập</h2>
      <p style="color:var(--gray-500);margin-bottom:32px;">Đăng nhập để lưu kết quả thi và tham gia bảng xếp hạng</p>
      <button class="btn btn--primary" onclick="doLogin()" style="font-size:16px;padding:14px 32px;width:100%;display:flex;align-items:center;justify-content:center;gap:10px;">
        <img src="https://www.google.com/favicon.ico" style="width:20px;height:20px;"/> Đăng nhập bằng Google
      </button>
      <p style="margin-top:24px;">
        <a onclick="goHome()" style="color:var(--sf-blue);cursor:pointer;">← Quay lại trang chủ (thi không cần đăng nhập)</a>
      </p>
    </div>
    ${renderFooter()}
  `;
}

function renderUsernamePopup() {
  // Check if popup already exists
  if (document.getElementById('username-popup')) return;
  const overlay = document.createElement('div');
  overlay.id = 'username-popup';
  overlay.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;">
      <div style="background:#fff;border-radius:16px;padding:40px;max-width:420px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="font-size:48px;margin-bottom:16px;">🎉</div>
        <h2 style="margin-bottom:8px;color:var(--gray-800);">Chào mừng bạn!</h2>
        <p style="color:var(--gray-500);margin-bottom:24px;">Đặt tên hiển thị để xuất hiện trên bảng xếp hạng</p>
        <input id="username-input" type="text" placeholder="Ví dụ: Nam Pham" 
          style="width:100%;padding:12px 16px;border:2px solid var(--gray-200);border-radius:8px;font-size:16px;outline:none;box-sizing:border-box;margin-bottom:16px;"
          maxlength="30"/>
        <button class="btn btn--primary" onclick="saveUsername()" style="width:100%;padding:12px;font-size:15px;">Xác nhận ✓</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('username-input')?.focus(), 100);
}

async function renderLeaderboard() {
  app.innerHTML = `
    ${renderNavbar()}
    <div class="mode-selection fade-in" style="max-width:700px;">
      <h2 style="margin-bottom:8px;">🏆 Bảng Xếp Hạng</h2>
      <p style="color:var(--gray-500);margin-bottom:16px;">Top 20 điểm cao nhất — Chế độ Thi thật</p>
      <div style="display:flex;justify-content:center;margin-bottom:24px;">
        <div style="position:relative;display:inline-block;">
          <select id="cert-filter" onchange="filterLeaderboard(this.value)" 
            style="appearance:none;-webkit-appearance:none;padding:10px 44px 10px 16px;
            border:2px solid var(--sf-blue);border-radius:12px;font-size:14px;font-weight:600;
            background:linear-gradient(135deg,rgba(1,118,211,0.04),rgba(1,118,211,0.08));
            color:var(--sf-blue);cursor:pointer;min-width:240px;
            box-shadow:0 2px 8px rgba(1,118,211,0.12);outline:none;transition:all .2s;">
            <option value="all">⏳ Đang tải...</option>
          </select>
          <span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--sf-blue);font-size:12px;">▼</span>
        </div>
      </div>
      <div id="leaderboard-content" style="text-align:center;padding:40px;">⏳ Đang tải...</div>
      <div style="margin-top:24px;">
        <button class="btn btn--ghost" onclick="goHome()">← Quay lại</button>
      </div>
    </div>
    ${renderFooter()}
  `;
  if (!state.leaderboardData) {
    try {
      state.leaderboardData = await getAllLeaderboard(100);
      state.leaderboardData = state.leaderboardData.filter(s => s.mode === 'full');
    } catch (err) {
      console.error(err);
      const content = document.getElementById('leaderboard-content');
      if (content) content.innerHTML = '<p style="color:var(--sf-error);">Không thể tải bảng xếp hạng. Vui lòng thử lại sau.</p>';
      return;
    }
  }
  const selected = state.leaderboardFilter || 'all';
  // Build dropdown options
  const certs = [...new Set((state.leaderboardData || []).map(s => s.certName).filter(Boolean))];
  const dropdown = document.getElementById('cert-filter');
  if (dropdown) {
    dropdown.innerHTML = `<option value="all">📋 Tất cả chứng chỉ</option>` 
      + certs.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
  }
  buildLeaderboardTable(selected);
}

function buildLeaderboardTable(certFilter) {
  let scores = [...(state.leaderboardData || [])];
  if (certFilter && certFilter !== 'all') {
    scores = scores.filter(s => s.certName === certFilter);
  }
  scores = scores.slice(0, 20);
  const content = document.getElementById('leaderboard-content');
  if (!content) return;
  if (scores.length === 0) {
    content.innerHTML = '<p style="color:var(--gray-400);padding:40px;">Chưa có ai thi. Hãy là người đầu tiên! 🚀</p>';
    return;
  }
  const rows = scores.map((s, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    const timeMin = s.timeUsed ? Math.round(s.timeUsed / 60) : '-';
    const isMe = state.user && s.uid === state.user.uid;
    const highlight = isMe ? 'background:rgba(1,118,211,0.06);font-weight:600;' : '';
    return `<tr style="${highlight}">
      <td style="padding:10px 12px;font-size:16px;">${medal}</td>
      <td style="padding:10px 12px;text-align:left;">${s.username || 'Anonymous'}${isMe ? ' <span style="color:var(--sf-blue);font-size:11px;">(Bạn)</span>' : ''}</td>
      <td style="padding:10px 12px;color:var(--gray-400);font-size:12px;">${s.certName || '-'}</td>
      <td style="padding:10px 12px;font-weight:700;color:${s.score >= 65 ? 'var(--sf-success)' : 'var(--sf-error)'};">${s.score}%</td>
      <td style="padding:10px 12px;">${s.correct}/${s.total}</td>
      <td style="padding:10px 12px;color:var(--gray-500);">${timeMin} phút</td>
    </tr>`;
  }).join('');
  content.innerHTML = `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:2px solid var(--gray-200);">
          <th style="padding:10px 12px;font-size:13px;color:var(--gray-500);">#</th>
          <th style="padding:10px 12px;text-align:left;font-size:13px;color:var(--gray-500);">Tên</th>
          <th style="padding:10px 12px;font-size:13px;color:var(--gray-500);">Chứng chỉ</th>
          <th style="padding:10px 12px;font-size:13px;color:var(--gray-500);">Điểm</th>
          <th style="padding:10px 12px;font-size:13px;color:var(--gray-500);">Đúng</th>
          <th style="padding:10px 12px;font-size:13px;color:var(--gray-500);">Thời gian</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
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
  // Partial update: chỉ cập nhật trạng thái selected của mode cards, không re-render toàn trang
  document.querySelectorAll('.mode-card').forEach(card => card.classList.remove('selected'));
  const cards = document.querySelectorAll('.mode-card');
  if (mode === 'demo' && cards[0]) cards[0].classList.add('selected');
  if (mode === 'full' && cards[1]) cards[1].classList.add('selected');
  if (mode === 'practice' && cards[2]) cards[2].classList.add('selected');
  // Enable start button
  const startBtn = document.querySelector('.btn--primary[onclick="startExam()"]');
  if (startBtn) startBtn.removeAttribute('disabled');
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
  state.hintShown = {};  // Reset hint khi bắt đầu bài thi mới
  state.timerStart = Date.now();

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
    const hintBtn = state.mode !== 'practice' ? `<button class="btn btn--ghost" onclick="toggleHint()" style="margin-left:8px;">${hintBtnLabel}</button>` : '';
    const aiBtn = `<button class="btn btn--ai" onclick="askAIExpert()" style="margin-left:8px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;font-weight:600;">🧠 Gợi ý từ chuyên gia</button>`;
    navLeft.innerHTML = `<button class="btn btn--ghost" onclick="prevQuestion()" ${state.currentIndex === 0 ? 'disabled' : ''}>← Trước</button>${practiceBtn}${hintBtn}${aiBtn}`;
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

window.nextQuestion = function() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex++;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

window.goToQuestion = function(i) {
  state.currentIndex = i;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

window.askAIExpert = function() {
  const q = state.questions[state.currentIndex];
  if (q) openAIExpertPopup(q);
}

window.submitExam = async function() {
  clearInterval(state.timerInterval);
  state.submitted = true;
  state.screen = 'results';
  render();
  window.scrollTo(0, 0);

  // Auto-save score to Firebase if logged in
  if (state.user && state.mode === 'full') {
    try {
      const total = state.questions.length;
      let correct = 0;
      state.questions.forEach((q, i) => {
        const selected = state.answers[i] || [];
        const correctArr = q.correct.split(',').map(s => s.trim());
        if (selected.length === correctArr.length && selected.every(a => correctArr.includes(a))) correct++;
      });
      const score = Math.round((correct / total) * 100);
      const timeUsed = Math.round((Date.now() - state.timerStart) / 1000);
      await saveScore({
        uid: state.user.uid,
        username: state.userProfile?.username || state.user.displayName || 'Anonymous',
        certName: state.certData?.certification || 'Unknown',
        mode: state.mode,
        score,
        correct,
        total,
        timeUsed
      });
      console.log('Score saved to leaderboard!');
    } catch (err) {
      console.error('Failed to save score:', err);
    }
  }
}

window.retryExam = function() {
  state.screen = 'mode';
  render();
}

window.doLogin = async function() {
  try {
    await loginWithGoogle();
  } catch (err) {
    console.error('Login failed:', err);
  }
}

window.doLogout = async function() {
  await logout();
  state.user = null;
  state.userProfile = null;
  render();
}

window.saveUsername = async function() {
  const input = document.getElementById('username-input');
  const username = input?.value?.trim();
  if (!username) { input?.focus(); return; }
  try {
    await saveUserProfile(state.user.uid, { username });
    state.userProfile = { ...state.userProfile, username };
    state.showUsernamePopup = false;
    document.getElementById('username-popup')?.remove();
    render();
  } catch (err) {
    console.error('Failed to save username:', err);
  }
}

window.showLeaderboard = function() {
  state.screen = 'leaderboard';
  state.leaderboardFilter = null;
  state.leaderboardData = null;
  render();
}

window.filterLeaderboard = function(certName) {
  state.leaderboardFilter = certName;
  buildLeaderboardTable(certName);
}

window.toggleLang = function() {
  state.lang = state.lang === 'vi' ? 'en' : 'vi';
  render();
}

// ========== INIT ==========
onAuthChange(async (user) => {
  state.authLoading = false;
  state.user = user;
  if (user) {
    const profile = await getUserProfile(user.uid);
    state.userProfile = profile;
    // First time login: show username popup
    if (!profile || !profile.username) {
      state.showUsernamePopup = true;
    }
  }
  render();
});
