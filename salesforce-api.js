// ============================================
// SALESFORCE API CLIENT
// Kết nối trực tiếp Database Salesforce qua REST API
// Thay thế hoàn toàn file JSON tĩnh
// ============================================

const SF_API_BASE = '/api/sf/v1/platform';

/**
 * Lấy danh sách tất cả chứng chỉ từ Salesforce
 * @returns {Promise<Array>} [{id, name, passingScore, totalEnrolled}]
 */
export async function fetchCertifications() {
  const res = await fetch(`${SF_API_BASE}/certifications`);
  if (!res.ok) throw new Error(`SF API error: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'API returned error');
  
  return json.data.map(cert => ({
    id: cert.Id,
    name: cert.Name,
    passingScore: cert.Passing_Score__c || 65,
    totalEnrolled: cert.Total_Enrolled__c || 0
  }));
}

/**
 * Lấy danh sách câu hỏi theo chứng chỉ từ Salesforce Database
 * Trả về format tương thích 100% với cấu trúc pd1.json cũ
 * @param {string} certId - Salesforce Record ID của Certification
 * @returns {Promise<Object>} { certification, totalQuestions, questions: [...] }
 */
export async function fetchQuestions(certId) {
  const url = certId 
    ? `${SF_API_BASE}/questions?certId=${certId}` 
    : `${SF_API_BASE}/questions`;
    
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SF API error: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'API returned error');
  
  // Transform từ format Salesforce → format tương thích pd1.json
  const questions = json.data.map((q, index) => ({
    id: index + 1,
    sfId: q.id,
    question: q.question || '',
    questionVI: q.questionVI || q.question || '',
    options: q.options || {},
    optionsVI: q.optionsVI || q.options || {},
    correct: q.correctAnswer || '',
    isMulti: q.isMultiSelect === true,
    explanation: q.explanation || ''
  }));
  
  return {
    certification: 'Salesforce Certified Platform Developer I',
    totalQuestions: questions.length,
    examSize: 65,
    passingScore: 65,
    timeLimit: 105,
    questions
  };
}

/**
 * Load cert data - thử Salesforce API trước, fallback về JSON tĩnh
 * @param {string} certId - 'pd1' hoặc Salesforce record ID
 * @returns {Promise<Object>} cert data object
 */
export async function loadCertFromSalesforce(certId) {
  try {
    // Bước 1: Lấy danh sách Certifications từ Salesforce
    const certs = await fetchCertifications();
    console.log('✅ Salesforce connected! Certifications:', certs);
    
    // Bước 2: Tìm certification phù hợp
    // Nếu certId là 'pd1', tìm theo tên chứa "Platform Developer"
    let targetCert;
    if (certId === 'pd1') {
      targetCert = certs.find(c => c.name.includes('Platform Developer'));
    } else {
      targetCert = certs.find(c => c.id === certId);
    }
    
    if (!targetCert) {
      console.warn('⚠️ Cert not found in Salesforce, falling back to JSON');
      return null;
    }
    
    // Bước 3: Lấy câu hỏi từ Salesforce Database
    const certData = await fetchQuestions(targetCert.id);
    certData.certification = targetCert.name;
    certData.passingScore = targetCert.passingScore;
    
    console.log(`✅ Loaded ${certData.totalQuestions} questions from Salesforce Database`);
    return certData;
    
  } catch (err) {
    console.warn('⚠️ Salesforce API unavailable, falling back to static JSON:', err.message);
    return null; // Signal to use fallback
  }
}
