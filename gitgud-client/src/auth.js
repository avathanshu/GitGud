// auth.js — place in src/
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";
import { app } from "./firebase";

// auth must be initialised FIRST — everything below depends on it
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

export const registerWithEmail = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

export const loginWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const loginWithGoogle = () =>
  signInWithPopup(auth, googleProvider);

export const logout = () => signOut(auth);

export const onAuth = (cb) => onAuthStateChanged(auth, cb);

// These now safely reference auth because it is already defined above
export const verifyEmail = (user) => sendEmailVerification(user);

export const sendPasswordReset = (email) =>
  sendPasswordResetEmail(auth, email);
