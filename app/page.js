'use client';
import { useState } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

// 1. Replace with your actual Firebase config from the console
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Force refresh to get a fresh ID Token
      const idToken = await userCredential.user.getIdToken(true);
      setToken(idToken);
    } catch (error) {
      alert("Login failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(token);
    alert("Token copied!");
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>Firebase Auth Tester</h2>
        <form onSubmit={handleLogin} style={styles.form}>
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            style={styles.input}
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            style={styles.input}
          />
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Logging in...' : 'Login & Get Token'}
          </button>
        </form>

        {token && (
          <div style={styles.result}>
            <p><strong>ID Token:</strong></p>
            <textarea 
              readOnly 
              value={token} 
              style={styles.textarea}
            />
            <button onClick={copyToClipboard} style={styles.copyBtn}>
              Copy Token for API Test
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f2f5' },
  card: { padding: '2rem', background: '#fff', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '400px' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' },
  input: { padding: '0.8rem', border: '1px solid #ddd', borderRadius: '4px' },
  button: { padding: '0.8rem', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  result: { marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1rem' },
  textarea: { width: '100%', height: '100px', fontSize: '12px', marginTop: '0.5rem', wordBreak: 'break-all' },
  copyBtn: { marginTop: '0.5rem', color: '#007bff', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }
};