'use client';

import { useState } from 'react';

export default function RegisterPage() {
  const [form, setForm] = useState({
    namaLengkap: '', nick: '', noWa: '', kota: '', lokasiFavorit: '', password: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Jika field noWa dan value diawali '0' dan panjang > 1, ubah jadi '62' + sisanya
    if (name === 'noWa') {
      if (value.startsWith('0') && value.length > 1) {
        const newValue = '62' + value.slice(1);
        setForm({ ...form, [name]: newValue });
        return;
      }
    }
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        setForm({ namaLengkap: '', nick: '', noWa: '', kota: '', lokasiFavorit: '', password: '' });
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Terjadi kesalahan' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <a href="/" style={{ marginBottom: '24px', display: 'inline-block', fontSize: '13px', color: '#888', borderBottom: '0.5px solid #e5e5e5', paddingBottom: '4px', textDecoration: 'none' }}>← Kembali</a>
      <h1 style={{ fontSize: '28px', fontWeight: '500', margin: '0 0 8px' }}>Daftar</h1>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '32px' }}>Gratis. Langsung cari lawan.</p>

      {message && (
        <div style={{ marginBottom: '16px', padding: '10px', background: message.type === 'success' ? '#e0f2e9' : '#fee2e2', color: message.type === 'success' ? '#1d4e2d' : '#b91c1c' }}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '1px', color: '#888', marginBottom: '6px' }}>NAMA LENGKAP</div>
          <input type="text" name="namaLengkap" value={form.namaLengkap} onChange={handleChange} placeholder="Nama lengkap (opsional)" style={{ width: '100%', padding: '12px', border: '0.5px solid #e5e5e5', borderRadius: '0', fontSize: '14px', outline: 'none' }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '1px', color: '#888', marginBottom: '6px' }}>NICK</div>
          <input type="text" name="nick" value={form.nick} onChange={handleChange} placeholder="Nama panggilan (unik)" required style={{ width: '100%', padding: '12px', border: '0.5px solid #e5e5e5', borderRadius: '0', fontSize: '14px', outline: 'none' }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '1px', color: '#888', marginBottom: '6px' }}>NO. WHATSAPP</div>
          <input type="tel" name="noWa" value={form.noWa} onChange={handleChange} placeholder="08xxxxxxxxxx" required style={{ width: '100%', padding: '12px', border: '0.5px solid #e5e5e5', borderRadius: '0', fontSize: '14px', outline: 'none' }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '1px', color: '#888', marginBottom: '6px' }}>KOTA</div>
          <input type="text" name="kota" value={form.kota} onChange={handleChange} placeholder="Bekasi, Jakarta, dll" style={{ width: '100%', padding: '12px', border: '0.5px solid #e5e5e5', borderRadius: '0', fontSize: '14px', outline: 'none' }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '1px', color: '#888', marginBottom: '6px' }}>LOKASI MAIN FAVORIT</div>
          <input type="text" name="lokasiFavorit" value={form.lokasiFavorit} onChange={handleChange} placeholder="Misal: Golden Billiard Bekasi" style={{ width: '100%', padding: '12px', border: '0.5px solid #e5e5e5', borderRadius: '0', fontSize: '14px', outline: 'none' }} />
        </div>
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '12px', fontWeight: '500', letterSpacing: '1px', color: '#888', marginBottom: '6px' }}>PASSWORD</div>
          <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Minimal 6 karakter" required style={{ width: '100%', padding: '12px', border: '0.5px solid #e5e5e5', borderRadius: '0', fontSize: '14px', outline: 'none' }} />
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '15px', background: '#000', color: '#fff', border: 'none', borderRadius: '0', fontSize: '15px', fontWeight: '500', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '16px' }}>
          <span>{loading ? 'Memproses...' : 'Daftar sekarang'}</span><span>→</span>
        </button>
      </form>

      <div style={{ textAlign: 'center', fontSize: '13px' }}>
        <span style={{ color: '#666' }}>Sudah punya akun? </span>
        <a href="/login" style={{ color: '#000', textDecoration: 'underline' }}>Masuk</a>
      </div>
    </main>
  );
}