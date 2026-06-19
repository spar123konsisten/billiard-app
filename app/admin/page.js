'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('confirmed');
  const [loading, setLoading] = useState(false);
  const [confirmedMatches, setConfirmedMatches] = useState([]);
  const [resultMatches, setResultMatches] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchConfirmed = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/matches?type=confirmed');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal memuat confirmed');
      }
      const data = await res.json();
      setConfirmedMatches(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/matches?type=results');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal memuat hasil');
      }
      const data = await res.json();
      setResultMatches(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'confirmed') {
      fetchConfirmed();
    } else {
      fetchResults();
    }
  }, [activeTab]);

  const handleCopy = async (type, id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('✅ Teks disalin ke clipboard!');
      setTimeout(() => setMessage(''), 3000);

      const res = await fetch('/api/admin/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      });
      if (res.ok) {
        if (type === 'match') {
          setConfirmedMatches(prev =>
            prev.map(m => (m.id === id ? { ...m, copied_at: new Date().toISOString() } : m))
          );
        } else {
          setResultMatches(prev =>
            prev.map(m => (m.skorId === id ? { ...m, copied_at: new Date().toISOString() } : m))
          );
        }
      }
    } catch (err) {
      alert('Gagal copy, silakan copy manual');
    }
  };

  const formatTanggal = (tanggal) => {
    if (!tanggal) return '-';
    const d = new Date(tanggal);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const now = new Date();
    const past = new Date(dateStr);
    const diffMs = now - past;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} menit lalu`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} jam lalu`;
    return `${Math.floor(diffHour / 24)} hari lalu`;
  };

  return (
    <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px 80px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600' }}>Admin</h1>
        <Link href="/" style={{ fontSize: '13px', color: '#888', textDecoration: 'underline' }}>← Kembali</Link>
      </div>

      {message && (
        <div style={{ padding: '10px', background: '#e0f2e9', color: '#1d4e2d', marginBottom: '16px', borderRadius: '4px' }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ padding: '10px', background: '#fee2e2', color: '#b91c1c', marginBottom: '16px', borderRadius: '4px' }}>
          Error: {error}
        </div>
      )}

      <div style={{ display: 'flex', borderBottom: '1px solid #e5e5e5', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('confirmed')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'none',
            border: 'none',
            fontSize: '14px',
            fontWeight: activeTab === 'confirmed' ? '600' : '400',
            color: activeTab === 'confirmed' ? '#000' : '#888',
            borderBottom: activeTab === 'confirmed' ? '2px solid #000' : 'none',
            cursor: 'pointer',
          }}
        >
          Confirmed
        </button>
        <button
          onClick={() => setActiveTab('hasil')}
          style={{
            flex: 1,
            padding: '10px 0',
            background: 'none',
            border: 'none',
            fontSize: '14px',
            fontWeight: activeTab === 'hasil' ? '600' : '400',
            color: activeTab === 'hasil' ? '#000' : '#888',
            borderBottom: activeTab === 'hasil' ? '2px solid #000' : 'none',
            cursor: 'pointer',
          }}
        >
          Hasil
        </button>
      </div>

      {loading && <p style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>Memuat...</p>}

      {activeTab === 'confirmed' && !loading && (
        <>
          <h2 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '16px', color: '#888', letterSpacing: '1px' }}>
            MATCH CONFIRMED
          </h2>
          {confirmedMatches.length === 0 && (
            <p style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>Belum ada match confirmed.</p>
          )}
          {confirmedMatches.map((m) => (
            <div
              key={m.id}
              style={{
                border: '0.5px solid #e5e5e5',
                borderRadius: '4px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
                {m.challenger} vs {m.challenged}
              </div>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                {formatTanggal(m.tanggal)} · {m.waktu} · {m.lokasi}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#aaa' }}>{timeAgo(m.created_at)}</span>
                {m.copied_at ? (
                  <span style={{ fontSize: '12px', color: '#888' }}>✅ Sudah di-copy</span>
                ) : (
                  <button
                    onClick={() =>
                      handleCopy(
                        'match',
                        m.id,
                        `✅ Match confirmed!\n${m.challenger} vs ${m.challenged}\n${formatTanggal(m.tanggal)} ${m.waktu} · ${m.lokasi}`
                      )
                    }
                    style={{
                      padding: '4px 12px',
                      background: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Copy untuk Grup
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {activeTab === 'hasil' && !loading && (
        <>
          <h2 style={{ fontSize: '14px', fontWeight: '500', marginBottom: '16px', color: '#888', letterSpacing: '1px' }}>
            HASIL MATCH
          </h2>
          {resultMatches.length === 0 && (
            <p style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>Belum ada hasil match.</p>
          )}
          {resultMatches.map((m) => (
            <div
              key={m.id}
              style={{
                border: '0.5px solid #e5e5e5',
                borderRadius: '4px',
                padding: '16px',
                marginBottom: '16px',
              }}
            >
              <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
                {m.pemenang} menang {m.skor}
              </div>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                vs {m.pecundang} · Naik {m.tierBaru}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ fontSize: '12px', color: '#aaa' }}>{timeAgo(m.created_at)}</span>
                {m.copied_at ? (
                  <span style={{ fontSize: '12px', color: '#888' }}>✅ Sudah di-copy</span>
                ) : (
                  <button
                    onClick={() =>
                      handleCopy(
                        'skor',
                        m.skorId,
                        `🎱 Hasil match:\n${m.pemenang} menang ${m.skor} vs ${m.pecundang}\n${m.pemenang} naik ke ${m.tierBaru}`
                      )
                    }
                    style={{
                      padding: '4px 12px',
                      background: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Copy untuk Grup
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </main>
  );
}