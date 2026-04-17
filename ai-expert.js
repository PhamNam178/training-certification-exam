// ============================================
// AI EXPERT HINT - Google Gemini Streaming
// Gợi ý từ chuyên gia AI (1 chiều, không chat)
// ============================================

const AI_ENDPOINT = '/api/ai/models/gemini-flash-latest:streamGenerateContent?alt=sse';

/**
 * Mở popup AI Expert và stream câu trả lời realtime
 * @param {Object} question - câu hỏi hiện tại { question, options, questionVI, ... }
 */
export async function openAIExpertPopup(question) {
  // Tạo overlay + popup
  createPopupDOM();
  
  const contentEl = document.getElementById('ai-expert-content');
  const statusEl = document.getElementById('ai-expert-status');
  
  // Build prompt
  const prompt = buildPrompt(question);
  
  try {
    statusEl.textContent = '🤖 Đang kết nối AI...';
    statusEl.className = 'ai-expert__status connecting';
    
    // Hiển thị loading tips xoay vòng để giảm cảm giác chờ
    const tips = [
      '🔍 Đang đọc câu hỏi...',
      '📚 Tra cứu tài liệu Salesforce...',
      '🧠 Phân tích từng đáp án...',
      '💡 Chuẩn bị mẹo chọn đáp án...',
      '✍️ Đang soạn câu trả lời...'
    ];
    let tipIndex = 0;
    const tipInterval = setInterval(() => {
      contentEl.innerHTML = `
        <div style="text-align:center;padding:40px 20px;">
          <div class="ai-expert__loading"><div class="ai-pulse"></div><div class="ai-pulse"></div><div class="ai-pulse"></div></div>
          <div style="font-size:15px;color:#667eea;font-weight:600;margin-top:16px;transition:opacity 0.3s;">${tips[tipIndex % tips.length]}</div>
        </div>`;
      tipIndex++;
    }, 1500);
    
    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error ${response.status}: ${errText}`);
    }

    statusEl.textContent = '⚡ Đang phân tích...';
    statusEl.className = 'ai-expert__status streaming';
    clearInterval(tipInterval);

    // Stream SSE response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Parse SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              fullText += text;
              contentEl.innerHTML = formatAIResponse(fullText);
              // Auto-scroll to bottom
              contentEl.scrollTop = contentEl.scrollHeight;
            }
          } catch (e) {
            // Skip malformed JSON chunks
          }
        }
      }
    }

    statusEl.textContent = '✅ Phân tích hoàn tất';
    statusEl.className = 'ai-expert__status done';
    
    // Final render with complete text
    contentEl.innerHTML = formatAIResponse(fullText);

  } catch (err) {
    clearInterval(tipInterval);
    console.error('AI Expert error:', err);
    statusEl.textContent = '❌ Lỗi kết nối';
    statusEl.className = 'ai-expert__status error';
    contentEl.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:48px;margin-bottom:16px;">🔑</div>
        <h3 style="color:var(--gray-700);margin-bottom:8px;">Cần cấu hình API Key</h3>
        <p style="color:var(--gray-500);font-size:14px;line-height:1.6;">
          1. Truy cập <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--sf-blue);">Google AI Studio</a><br>
          2. Tạo API Key miễn phí<br>
          3. Dán vào file <code>.env</code> → <code>GEMINI_API_KEY=xxx</code><br>
          4. Restart Vite server
        </p>
        <p style="color:var(--gray-400);font-size:12px;margin-top:12px;">Error: ${err.message}</p>
      </div>
    `;
  }
}

function buildPrompt(q) {
  const optionsText = Object.entries(q.options)
    .map(([key, val]) => `${key}. ${val}`)
    .join('\n');

  return `Bạn là chuyên gia Salesforce với 10 năm kinh nghiệm. Hãy phân tích câu hỏi thi chứng chỉ Salesforce dưới đây và trả lời CHÍNH XÁC theo format bên dưới. Trả lời bằng tiếng Việt, giữ nguyên thuật ngữ kỹ thuật bằng tiếng Anh.

**CÂU HỎI (English):**
${q.question}

**CÁC ĐÁP ÁN:**
${optionsText}

---
Hãy trả lời ĐÚNG theo thứ tự sau:

## 📝 Dịch câu hỏi
(Dịch câu hỏi sang tiếng Việt, giữ nguyên các thuật ngữ kỹ thuật)

## 📋 Dịch đáp án
(Dịch từng đáp án A, B, C, D... sang tiếng Việt)

## 💡 Mẹo chọn đáp án
(Phân tích từng đáp án, giải thích tại sao đúng hoặc sai, đưa ra keyword cần nhớ và mẹo để nhận diện đáp án đúng trong thi thật. Viết ngắn gọn, dễ hiểu.)`;
}

function formatAIResponse(text) {
  // Convert markdown-like formatting to HTML
  let html = text
    // Headers
    .replace(/## (.*)/g, '<h3 class="ai-section-title">$1</h3>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Line breaks
    .replace(/\n/g, '<br>')
    // Clean up double breaks
    .replace(/<br><br>/g, '<div style="height:8px;"></div>');

  return `<div class="ai-response-text">${html}</div>`;
}

function createPopupDOM() {
  // Remove existing popup if any
  const existing = document.getElementById('ai-expert-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ai-expert-overlay';
  overlay.innerHTML = `
    <div class="ai-expert-popup">
      <div class="ai-expert__header">
        <div class="ai-expert__title">
          <span class="ai-expert__icon">🧠</span>
          <span>Gợi ý từ chuyên gia AI</span>
        </div>
        <button class="ai-expert__close" onclick="closeAIExpert()">✕</button>
      </div>
      <div id="ai-expert-status" class="ai-expert__status connecting">🤖 Đang kết nối AI...</div>
      <div id="ai-expert-content" class="ai-expert__content">
        <div class="ai-expert__loading">
          <div class="ai-pulse"></div>
          <div class="ai-pulse"></div>
          <div class="ai-pulse"></div>
        </div>
      </div>
      <div class="ai-expert__footer">
        <span>⚡ Powered by Google Gemini</span>
        <span>•</span>
        <span>Chỉ hỗ trợ xem — Không chat</span>
      </div>
    </div>
  `;

  // Inject styles if not already present
  if (!document.getElementById('ai-expert-styles')) {
    const style = document.createElement('style');
    style.id = 'ai-expert-styles';
    style.textContent = getPopupStyles();
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);

  // Close on overlay click (outside popup)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAIExpert();
  });

  // Close on Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeAIExpert();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

window.closeAIExpert = function() {
  const overlay = document.getElementById('ai-expert-overlay');
  if (overlay) {
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 200);
  }
}

function getPopupStyles() {
  return `
    #ai-expert-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(4px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: aiOverlayIn 0.2s ease;
      padding: 20px;
    }
    #ai-expert-overlay.closing {
      animation: aiOverlayOut 0.2s ease forwards;
    }
    @keyframes aiOverlayIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes aiOverlayOut { from { opacity: 1; } to { opacity: 0; } }

    .ai-expert-popup {
      background: #fff;
      border-radius: 16px;
      width: 100%;
      max-width: 640px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 60px rgba(0,0,0,0.3);
      animation: aiPopupIn 0.3s cubic-bezier(0.16,1,0.3,1);
      overflow: hidden;
    }
    @keyframes aiPopupIn {
      from { transform: translateY(30px) scale(0.95); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }

    .ai-expert__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
    }
    .ai-expert__title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 16px;
    }
    .ai-expert__icon {
      font-size: 22px;
    }
    .ai-expert__close {
      background: rgba(255,255,255,0.2);
      border: none;
      color: #fff;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .ai-expert__close:hover {
      background: rgba(255,255,255,0.35);
    }

    .ai-expert__status {
      padding: 8px 20px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    .ai-expert__status.connecting { background: #e8f0fe; color: #1a73e8; }
    .ai-expert__status.streaming { background: #fef7e0; color: #e37400; }
    .ai-expert__status.done { background: #e6f4ea; color: #137333; }
    .ai-expert__status.error { background: #fce8e6; color: #c5221f; }

    .ai-expert__content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      font-size: 14px;
      line-height: 1.7;
      color: #333;
      min-height: 200px;
      max-height: 55vh;
    }

    .ai-expert__content h3.ai-section-title {
      font-size: 15px;
      font-weight: 700;
      color: #5b21b6;
      margin: 16px 0 8px 0;
      padding-bottom: 6px;
      border-bottom: 2px solid #ede9fe;
    }
    .ai-expert__content h3.ai-section-title:first-child {
      margin-top: 0;
    }
    .ai-expert__content strong {
      color: #1e293b;
    }
    .ai-expert__content code {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
      color: #7c3aed;
    }

    .ai-response-text {
      word-break: break-word;
    }

    .ai-expert__footer {
      padding: 10px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: center;
    }

    /* Loading animation */
    .ai-expert__loading {
      display: flex;
      gap: 6px;
      justify-content: center;
      padding: 60px 0;
    }
    .ai-pulse {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #667eea;
      animation: aiPulse 1.2s ease-in-out infinite;
    }
    .ai-pulse:nth-child(2) { animation-delay: 0.2s; }
    .ai-pulse:nth-child(3) { animation-delay: 0.4s; }
    @keyframes aiPulse {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }
  `;
}
