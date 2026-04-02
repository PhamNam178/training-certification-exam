// Firebase Configuration
// TODO: Replace with your Firebase project config from console.firebase.google.com
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs, doc, setDoc, getDoc, where, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAYWCEty_uc9-ZIUtzMZgX1hBRZ7B0tv0A",
  authDomain: "certification-exam-d8184.firebaseapp.com",
  projectId: "certification-exam-d8184",
  storageBucket: "certification-exam-d8184.firebasestorage.app",
  messagingSenderId: "617005616891",
  appId: "1:617005616891:web:aeeae0efe55cb16bee2a5e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ========== AUTH ==========
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function logout() {
  await signOut(auth);
}

export function getCurrentUser() {
  return auth.currentUser;
}

// ========== USER PROFILE ==========
export async function getUserProfile(uid) {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

export async function saveUserProfile(uid, data) {
  const docRef = doc(db, 'users', uid);
  await setDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// ========== SCORES ==========
export async function saveScore(scoreData) {
  const docRef = await addDoc(collection(db, 'scores'), {
    ...scoreData,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function getLeaderboard(certName, mode, limitCount = 20) {
  const q = query(
    collection(db, 'scores'),
    where('certName', '==', certName),
    where('mode', '==', mode),
    orderBy('score', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  // Secondary sort by timeUsed (ascending) on client side
  return results.sort((a, b) => b.score - a.score || (a.timeUsed || 0) - (b.timeUsed || 0));
}

export async function getAllLeaderboard(limitCount = 20) {
  const q = query(
    collection(db, 'scores'),
    orderBy('score', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return results.sort((a, b) => b.score - a.score || (a.timeUsed || 0) - (b.timeUsed || 0));
}
