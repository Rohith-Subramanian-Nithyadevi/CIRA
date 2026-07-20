import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAAsQP95EGDZpl-yDPOeGuWRlvSoqzI72M",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "cira-f5704.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "cira-f5704",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "cira-f5704.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "746869425977",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:746869425977:web:31905af166bcafb9474ae8",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-DM7JX7KFXQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Customize Google Provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export default app;

