'use client';
import { useState } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

// 1. Replace with your actual Firebase config from the console
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export default function GoogleLoginPage() {
  const [token, setToken] = useState('');

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      // This is the token your backend verifyUser(req) needs
      const idToken = await result.user.getIdToken(true);
      setToken(idToken);
    } catch (error) {
      console.error("Login Error:", error);
      alert(error.message);
    }
  };

  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>API Auth Tester (Google)</h1>
      
      <button 
        onClick={handleGoogleLogin}
        style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#4285F4', color: 'white', border: 'none', borderRadius: '4px' }}
      >
        Sign in with Google
      </button>

      {token && (
        <div style={{ marginTop: '20px' }}>
          <p><strong>Success! Copy this token into Postman:</strong></p>
          <textarea 
            readOnly 
            value={token} 
            style={{ width: '100%', height: '150px', marginTop: '10px', fontSize: '12px' }}
          />
          <button 
            onClick={() => {
              navigator.clipboard.writeText(token);
              alert("Copied!");
            }}
            style={{ marginTop: '10px', display: 'block', margin: '10px auto' }}
          >
            Copy to Clipboard
          </button>
        </div>
      )}
    </div>
  );
}