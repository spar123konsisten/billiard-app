'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ChallengeForm({ challengedId, username, defaultLokasi }) {
  const router = useRouter();
  const [lokasi, setLokasi] = useState(defaultLokasi);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.target);
    try {
      const res = await fetch('/api/ajak-sparring', {
        method: 'POST',
        body: formData,
      });
      if (res.redirected) {
        router.push(res.url); // akan menuju ke /pertandingan
      } else {
        const data = await res.json();
        setError(data.error || 'Gagal mengirim ajakan');
        setLoading(false);
      }
    } catch (err) {
      setError('Terjadi kesalahan');
      setLoading(false);
    }
  };

  const handleResetLokasi = () => {
    setLokasi(defaultLokasi);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="challenged_id" value={challengedId} />
      <input type="hidden" name="username" value={username} />

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', marginBottom: '6px' }}>TANGGAL</label>
        <input
          type="date"
          name="tanggal"
          required
          min={new Date().toISOString().split('T')[0]}
          style={{ width: '100%', padding: '12px', border: '0.5px solid #e5e5e5', borderRadius: '4px', fontSize: '14px' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', marginBottom: '6px' }}>WAKTU</label>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {['Pagi', 'Siang', 'Sore', 'Malam'].map(w => (
            <label key={w} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="radio" name="waktu" value={w} required /> {w}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '28px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', marginBottom: '6px' }}>LOKASI</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            name="lokasi"
            value={lokasi}
            onChange={(e) => setLokasi(e.target.value)}
            required
            style={{ flex: 1, padding: '12px', border: '0.5px solid #e5e5e5', borderRadius: '4px', fontSize: '14px' }}
          />
          <button
            type="button"
            onClick={handleResetLokasi}
            style={{ padding: '10px 16px', background: '#f0f0f0', border: '0.5px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
          >
            Ubah
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '12px' }}>{error}</div>}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '14px',
          background: '#000',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          fontSize: '16px',
          fontWeight: '500',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '12px',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? 'Mengirim...' : 'Kirim Ajakan'}
      </button>
    </form>
  );
}