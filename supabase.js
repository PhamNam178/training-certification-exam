// ============================================
// SUPABASE CLIENT — Thay thế Firebase + Salesforce API
// Auth (Google) + Database (Questions, Scores, Profiles)
// ============================================
import { createClient } from '@supabase/supabase-js';

// Hardcoded fallbacks for Production (Vercel)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ppfnxxuphwukbaguttmd.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZm54eHVwaHd1a2JhZ3V0dG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODE5MzYsImV4cCI6MjA5Mzg1NzkzNn0.CN-oveqtFRnozHUzWPkXmBjfcafsu-EwpwVFXNw7V6Q';

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn('⚠️ VITE_SUPABASE_URL not found in env, using fallback.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== AUTH ==========
export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(session?.user ?? null);
    }
  );
  return () => subscription.unsubscribe();
}

export async function loginWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) throw error;
  return data;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Logout error:', error);
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ========== USER PROFILE ==========
export async function getUserProfile(uid) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching profile:', error);
  }
  return data;
}

export async function saveUserProfile(uid, profileData) {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: uid,
      ...profileData,
      updated_at: new Date().toISOString()
    });
  if (error) throw error;
}

// ========== QUESTIONS (thay thế Salesforce API) ==========
export async function loadQuestions(certId = 'pd1') {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('cert_id', certId)
    .order('question_no');

  if (error) throw error;

  // Transform sang format tương thích với main.js hiện tại
  const questions = (data || []).map(q => ({
    id:             q.question_no,
    question_en:    q.question_en,
    options:        q.options,
    correct:        q.correct_verified || q.correct,
    is_multi:       q.is_multi,
    question_vi:    q.question_vi,
    options_vi:     q.options_vi,
    ai_expert:      q.ai_expert,
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

// ========== SCORES / LEADERBOARD ==========
export async function saveScore(scoreData) {
  // Lấy user hiện tại nếu chưa có userId trong scoreData
  let userId = scoreData.userId;
  if (!userId) {
    const user = await getCurrentUser();
    userId = user?.id;
  }

  const { data, error } = await supabase
    .from('leaderboard')
    .insert({
      user_id:   userId,
      username:  scoreData.username,
      cert_id:   scoreData.certId || 'pd1',
      mode:      scoreData.mode,
      score:     scoreData.score,
      correct:   scoreData.correct,
      total:     scoreData.total,
      time_used: scoreData.timeUsed,
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

export async function getAllLeaderboard(limitCount = 20) {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('score', { ascending: false })
    .order('time_used', { ascending: true })
    .limit(limitCount);

  if (error) throw error;
  return data || [];
}

export async function getLeaderboard(certId, mode, limitCount = 20) {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .eq('cert_id', certId)
    .eq('mode', mode)
    .order('score', { ascending: false })
    .order('time_used', { ascending: true })
    .limit(limitCount);

  if (error) throw error;
  return data || [];
}
