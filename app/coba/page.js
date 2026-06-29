// app/coba/page.js
'use client';

import { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';

export default function CobaPage() {
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/user/me');
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Gagal fetch user');
        }
        const data = await res.json();
        setUserStats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const downloadCard = async () => {
    const card = document.getElementById('testCard');
    if (!card) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(card, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0a0a0a',
      });
      const link = document.createElement('a');
      link.download = 'test-share.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      alert('Gagal download: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Loading user data...</div>;
  if (error) return <div style={{ padding: 40, color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 400, margin: '0 auto' }}>
      <h2>Debug User</h2>
      <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, overflow: 'auto', fontSize: 12 }}>
        {JSON.stringify(userStats, null, 2)}
      </pre>

      <h3>Preview Card</h3>
      <div
        id="testCard"
        style={{
          width: 270,
          background: '#0a0a0a',
          borderRadius: 16,
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          color: '#fff',
          margin: '20px auto',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#EF5350', marginBottom: 4 }}>
          KALAH
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-2px', marginBottom: 6 }}>
          1–9
        </div>
        <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 12 }}>
          vs asdfgh · Rintis ★
        </div>
        <div style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.2)', marginBottom: 14 }} />
        <div style={{ fontSize: 13, opacity: 0.5, fontFamily: 'monospace', marginBottom: 6 }}>
          sparring.id/u/{userStats?.username || ''}
        </div>
        <div style={{ fontSize: 10, opacity: 0.2, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          billiard.id
        </div>
      </div>

      <button
        onClick={downloadCard}
        disabled={downloading}
        style={{
          display: 'block',
          width: '100%',
          padding: 14,
          background: '#000',
          color: '#fff',
          border: 'none',
          borderRadius: 30,
          fontWeight: 600,
          fontSize: 15,
          cursor: downloading ? 'default' : 'pointer',
          opacity: downloading ? 0.7 : 1,
        }}
      >
        {downloading ? 'Menyiapkan...' : '⬇️ Download Card'}
      </button>

      <p style={{ marginTop: 20, fontSize: 12, color: '#888' }}>
        Username dari API: <strong>{userStats?.username || 'tidak ada'}</strong>
      </p>
    </div>
  );
}