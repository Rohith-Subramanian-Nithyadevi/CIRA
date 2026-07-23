import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD-ezx_svUiUeJ2D-LGNT9G8JZ9364oCuQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "cira-auth-33e89.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "cira-auth-33e89",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "cira-auth-33e89.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "150187146499",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:150187146499:web:5441af130500217c41fd36",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-HXERX1XRQK"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Force Google prompt account selection
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
