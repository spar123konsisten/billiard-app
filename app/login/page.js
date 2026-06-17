'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      setError('Semua field harus diisi');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: trimmedIdentifier, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push(data.redirect);
      } else {
        setError(data.error || 'Login gagal');
      }
    } catch (err) {
      setError('Terjadi kesalahan, coba lagi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <a
        href="/"
        style={{
          display: 'inline-block',
          marginBottom: '24px',
          fontSize: '13px',
          color: '#888',
          textDecoration: 'none',
          borderBottom: '0.5px solid #e5e5e5',
          paddingBottom: '4px',
        }}
      >
        ← Kembali
      </a>

      <h1 style={{ fontSize: '28px', fontWeight: '500', margin: '0 0 8px' }}>Masuk</h1>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '32px' }}>Lanjut cari lawan.</p>

      {error && (
        <div style={{ marginBottom: '16px', padding: '10px', background: '#fee2e2', color: '#b91c1c', fontSize: '14px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', marginBottom: '6px' }}>
            NO. WHATSAPP / NICK
          </label>
          <input
            type="text"
            placeholder="08xxxxxxxxx atau nick"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '0.5px solid #e5e5e5',
              borderRadius: '0',
              fontSize: '14px',
              outline: 'none',
            }}
            required
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', marginBottom: '6px' }}>
            PASSWORD
          </label>
          <input
            type="password"
            placeholder="Password kamu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '0.5px solid #e5e5e5',
              borderRadius: '0',
              fontSize: '14px',
              outline: 'none',
            }}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '15px',
            background: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '0',
            fontSize: '15px',
            fontWeight: '500',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            marginBottom: '12px',
          }}
        >
          <span>{loading ? 'Memproses...' : 'Masuk'}</span>
          <span>→</span>
        </button>

        <div style={{ textAlign: 'right', marginBottom: '32px' }}>
          <a href="/lupa-password" style={{ fontSize: '12px', color: '#888', textDecoration: 'underline' }}>
            Lupa password?
          </a>
        </div>

        <div style={{ textAlign: 'center', fontSize: '13px', borderTop: '0.5px solid #e5e5e5', paddingTop: '24px' }}>
          <span style={{ color: '#666' }}>Belum punya akun? </span>
          <a href="/register" style={{ color: '#000', textDecoration: 'underline' }}>
            Daftar gratis
          </a>
        </div>
      </form>
    </main>
  );
}