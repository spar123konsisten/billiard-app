'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Hardcode nomor WA administrator (ganti dengan nomor sebenarnya)
const ADMIN_WHATSAPP = '6281234567890';

export default function ChallengeForm({ challengedId, defaultLokasi }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [popupData, setPopupData] = useState(null);
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_phone: '',
    tanggal: '',
    waktu: '',
    lokasi: defaultLokasi || '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      ...formData,
      challenged_id: challengedId,
    };

    try {
      const res = await fetch('/api/ajak-sparring-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengirim challenge');

      // Simpan data untuk popup
      setPopupData({
        guest_name: formData.guest_name,
        guest_phone: formData.guest_phone,
        tanggal: formData.tanggal,
        waktu: formData.waktu,
        lokasi: formData.lokasi,
      });
      setShowPopup(true);
      setLoading(false);

    } catch (err) {
      setError(err.message || 'Terjadi kesalahan');
      setLoading(false);
    }
  };

  const handlePopupConfirm = () => {
    setShowPopup(false);

    // Siapkan pesan WhatsApp
    const message = `Halo Administrator, saya ${popupData.guest_name} (WA: ${popupData.guest_phone}) mengajak challenge.%0A%0ATanggal: ${popupData.tanggal}%0AWaktu: ${popupData.waktu}%0ALokasi: ${popupData.lokasi}`;
    const waUrl = `https://api.whatsapp.com/send?phone=${ADMIN_WHATSAPP}&text=${message}`;

    // Redirect ke profil administrator
    router.push('/u/administrator');

    // Buka WhatsApp di tab baru setelah redirect (delay biar redirect dulu)
    setTimeout(() => {
      window.open(waUrl, '_blank');
    }, 500);
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="challenged_id" value={challengedId} />

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', marginBottom: '6px' }}>NAMA LENGKAP</label>
          <input
            type="text"
            name="guest_name"
            value={formData.guest_name}
            onChange={handleChange}
            required
            placeholder="Nama kamu"
            style={{ width: '100%', padding: '12px', border: '0.5px solid #e5e5e5', borderRadius: '4px', fontSize: '14px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', marginBottom: '6px' }}>NO. WHATSAPP</label>
          <input
            type="tel"
            name="guest_phone"
            value={formData.guest_phone}
            onChange={handleChange}
            required
            placeholder="08xxxxxxxxxx"
            style={{ width: '100%', padding: '12px', border: '0.5px solid #e5e5e5', borderRadius: '4px', fontSize: '14px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', marginBottom: '6px' }}>TANGGAL</label>
          <input
            type="date"
            name="tanggal"
            value={formData.tanggal}
            onChange={handleChange}
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
                <input
                  type="radio"
                  name="waktu"
                  value={w}
                  required
                  checked={formData.waktu === w}
                  onChange={handleChange}
                /> {w}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '28px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', color: '#888', marginBottom: '6px' }}>LOKASI</label>
          <input
            type="text"
            name="lokasi"
            value={formData.lokasi}
            onChange={handleChange}
            required
            placeholder="Contoh: Golden Billiard, Bekasi"
            style={{ width: '100%', padding: '12px', border: '0.5px solid #e5e5e5', borderRadius: '4px', fontSize: '14px' }}
          />
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
            💡 Masukkan lokasi favorit Administrator atau tempat yang kamu inginkan.
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

      {/* POPUP */}
      {showPopup && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#fff',
              maxWidth: '400px',
              width: '100%',
              padding: '32px 24px',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              position: 'relative',
            }}
          >
            {/* Icon atau judul */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>📢</div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Ajakan Terkirim!</h2>
            </div>

            <div style={{ fontSize: '14px', color: '#333', lineHeight: '1.7', marginBottom: '20px' }}>
              <p style={{ marginTop: 0, fontWeight: '500' }}>
                ✅ Challenge ke <strong>Administrator</strong> sudah berhasil dikirim.
              </p>
              <p style={{ marginBottom: '8px' }}>
                <strong>Selanjutnya, perhatikan hal ini:</strong>
              </p>
              <ol style={{ paddingLeft: '20px', margin: '8px 0 12px' }}>
                <li style={{ marginBottom: '6px' }}>
                  <strong>WhatsApp</strong> akan terbuka dalam beberapa detik — kirim pesan konfirmasi ke Administrator.
                </li>
                <li style={{ marginBottom: '6px' }}>
                  Pantau terus WhatsApp kamu, karena <strong>semua informasi</strong> tentang pertandingan (konfirmasi, perubahan jadwal, lokasi) akan disampaikan di sana.
                </li>
                <li style={{ marginBottom: '6px' }}>
                  Jika Administrator belum merespon, kamu bisa follow up lewat WhatsApp yang sudah terbuka.
                </li>
                <li style={{ marginBottom: '6px' }}>
                  <strong>Catatan:</strong> Sistem ini hanya sebagai pengantar — komunikasi utama tetap via WhatsApp.
                </li>
              </ol>
              <p style={{ marginBottom: 0, fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
                ⏳ Tunggu sebentar, WhatsApp akan terbuka otomatis.
              </p>
            </div>

            <button
              onClick={handlePopupConfirm}
              style={{
                width: '100%',
                padding: '14px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                marginTop: '4px',
              }}
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}