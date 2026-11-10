// firebase.js — satu-satunya tempat yang bicara langsung ke Firebase.
// ISI firebaseConfig di bawah dengan config project Firebase BARU Anda
// (Firebase Console → Project settings → Your apps → Web app → SDK setup).

import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, writeBatch, runTransaction,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: "AIzaSyA2s95Ba2ftnGmX-gShBiwZsPKc9vR3t5w",
  authDomain: "hrd-portal-15e32.firebaseapp.com",
  projectId: "hrd-portal-15e32",
  storageBucket: "hrd-portal-15e32.firebasestorage.app",
  messagingSenderId: "332260830840",
  appId: "1:332260830840:web:3ec599168233ee401fc78d"
};

export const isConfigured = !Object.values(firebaseConfig).some((v) => String(v).startsWith('ISI_'));

let app = null, auth = null, db = null;
if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}
export { auth, db };

// Membuat akun login untuk orang lain TANPA mengeluarkan admin yang sedang login:
// dibuat lewat instance Firebase kedua, lalu langsung keluar dari instance itu.
export async function createAuthUser(email, password) {
  const second = initializeApp(firebaseConfig, 'secondary-' + Date.now());
  try {
    const a = getAuth(second);
    const cred = await createUserWithEmailAndPassword(a, email, password);
    const uid = cred.user.uid;
    await signOut(a);
    return uid;
  } finally {
    await deleteApp(second);
  }
}

export async function changeOwnPassword(oldPass, newPass) {
  const u = auth.currentUser;
  const cred = EmailAuthProvider.credential(u.email, oldPass);
  await reauthenticateWithCredential(u, cred);
  await updatePassword(u, newPass);
}

export function authErrorMessage(e) {
  const c = e && e.code ? e.code : '';
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-login-credentials') return 'Username atau password salah.';
  if (c === 'auth/too-many-requests') return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
  if (c === 'auth/network-request-failed') return 'Tidak ada koneksi internet.';
  if (c === 'auth/email-already-in-use') return 'Username/email ini sudah terdaftar di sistem login.';
  if (c === 'auth/weak-password') return 'Password terlalu lemah (minimal 6 karakter).';
  if (c === 'auth/operation-not-allowed') return 'Login email/password belum diaktifkan di Firebase Console.';
  if (c === 'permission-denied' || c === 'firestore/permission-denied') return 'Akses ditolak oleh aturan keamanan. Pastikan firestore.rules sudah dipublikasikan.';
  return (e && e.message) || 'Terjadi kesalahan.';
}

export {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, writeBatch, runTransaction,
};
