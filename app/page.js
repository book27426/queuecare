'use client';
import { useState } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const API_URL = process.env.NEXT_PUBLIC_API_URL; // make sure this exists

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export default function GoogleLoginPage() {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);

      // 1️⃣ Google login
      const result = await signInWithPopup(auth, provider);

      // 2️⃣ Get Firebase ID token
      const idToken = await result.user.getIdToken(true);

      // 3️⃣ Send POST to backend

      console.log("API_URL:", API_URL);
      console.log("Final URL:", `${API_URL}api/v1/staff`);
      const response = await fetch(`${API_URL}api/v1/staff`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({})
      });

      const data = await response.json();

      console.log("Backend response:", data);
      alert("Success! Check console.");

    } catch (error) {
      console.error("Error:", error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>API Auth Tester (Google)</h1>

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        style={{
          padding: '10px 20px',
          cursor: 'pointer',
          backgroundColor: '#4285F4',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        {loading ? "Processing..." : "Sign in with Google & Send POST"}
      </button>
    </div>
  );
}