'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function AkunPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  const kotaOptions = ['Bekasi', 'Jakarta', 'Depok', 'Bogor', 'Bandung', 'Surabaya'];
  const lokasiOptions = [
    'Golden Billiard Bekasi',
    'Cue Masters Jakarta',
    'Break Point Depok',
    'Cue & Break Bogor',
    'Home Billiard Bandung',
    'Grand Billiard Surabaya'
  ];

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/user/profile');
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return;
          }
          const errorText = await res.text();
          console.error('API error:', errorText);
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error('Fetch error:', err);
        setMessage({ text: 'Gagal memuat profil', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [router]);

  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSimpan = async () => {
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namaLengkap: profile.namaLengkap,
          noWa: profile.no_wa,
          kota: profile.kota,
          lokasiFavorit: profile.lokasiFavorit,
          bio: profile.bio,
        }),
      });
      if (res.ok) {
        setMessage({ text: 'Perubahan disimpan', type: 'success' });
      } else {
        setMessage({ text: 'Gagal menyimpan perubahan', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Terjadi kesalahan', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleGantiFoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validasi tipe file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setMessage({ text: 'Format file harus JPG, PNG, atau WEBP', type: 'error' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ text: 'Ukuran file maksimal 2MB', type: 'error' });
      return;
    }

    setUploading(true);
    setMessage({ text: '', type: '' });
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await fetch('/api/user/upload-avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        // Update profile state dengan foto baru
        setProfile(prev => ({ ...prev, fotoUrl: data.fotoUrl }));
        setMessage({ text: 'Foto profil berhasil diubah', type: 'success' });
      } else {
        setMessage({ text: data.error || 'Gagal upload foto', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Terjadi kesalahan saat upload', type: 'error' });
    } finally {
      setUploading(false);
      // reset input file
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSalinLink = () => {
    navigator.clipboard.writeText(`sparring.id/u/${profile?.username || ''}`);
    alert('Link disalin!');
  };

  const handleKeluar = () => {
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  if (loading) {
    return (
      <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
        <p>Memuat profil...</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
        <p>Gagal memuat profil. <a href="/login">Login kembali</a></p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px 80px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '28px', fontWeight: '500', marginBottom: '24px' }}>Akun</h1>

      {/* Header profil */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'flex-start' }}>
        <img
          src={profile.fotoUrl || `https://picsum.photos/seed/${profile.id}/80/80`}
          alt={profile.namaLengkap}
          style={{ width: '80px', height: '80px', borderRadius: '4px', objectFit: 'cover' }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '4px' }}>{profile.namaLengkap}</div>
          <div style={{ fontSize: '13px', color: '#888', marginBottom: '4px' }}>{profile.rank} · {profile.poin} Poin</div>
          <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>sparring.id/u/{profile.username}</div>
          <button
            onClick={handleGantiFoto}
            disabled={uploading}
            style={{
              padding: '6px 12px',
              background: '#fff',
              border: '0.5px solid #e5e5e5',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: uploading ? 'default' : 'pointer',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? 'Mengunggah...' : 'Ganti foto'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Bagikan profil */}
      <div style={{ border: '0.5px solid #e5e5e5', borderRadius: '4px', padding: '12px 16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: '500', fontSize: '13px', marginBottom: '2px' }}>Bagikan profilmu</div>
          <div style={{ fontSize: '11px', color: '#888' }}>sparring.id/u/{profile.username}</div>
        </div>
        <button onClick={handleSalinLink} style={{ padding: '6px 12px', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Salin link</button>
      </div>

      {/* INFO PRIBADI */}
      <div style={{ border: '0.5px solid #e5e5e5', borderRadius: '4px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '16px', letterSpacing: '0.5px' }}>INFO PRIBADI</div>

        {message.text && (
          <div style={{ marginBottom: '12px', padding: '8px', background: message.type === 'success' ? '#e0f2e9' : '#fee2e2', color: message.type === 'success' ? '#1d4e2d' : '#b91c1c', fontSize: '13px' }}>
            {message.text}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>NAMA</div>
          <input
            type="text"
            value={profile.namaLengkap || ''}
            onChange={(e) => handleInputChange('namaLengkap', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e5e5e5', borderRadius: '4px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>NO. WHATSAPP</div>
          <input
            type="tel"
            value={profile.no_wa || ''}
            onChange={(e) => handleInputChange('no_wa', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e5e5e5', borderRadius: '4px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>KOTA</div>
          <select
            value={profile.kota || 'Bekasi'}
            onChange={(e) => handleInputChange('kota', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e5e5e5', borderRadius: '4px', fontSize: '14px', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }}
          >
            {kotaOptions.map(kota => <option key={kota} value={kota}>{kota}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>LOKASI MAIN FAVORIT</div>
          <select
            value={profile.lokasiFavorit || 'Golden Billiard Bekasi'}
            onChange={(e) => handleInputChange('lokasiFavorit', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e5e5e5', borderRadius: '4px', fontSize: '14px', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }}
          >
            {lokasiOptions.map(lok => <option key={lok} value={lok}>{lok}</option>)}
          </select>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>BIO (opsional)</div>
          <textarea
            value={profile.bio || ''}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e5e5e5', borderRadius: '4px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Simpan perubahan */}
      <button onClick={handleSimpan} disabled={saving} style={{ width: '100%', padding: '12px', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '15px', fontWeight: '500', cursor: 'pointer', marginBottom: '24px' }}>
        {saving ? 'Menyimpan...' : 'Simpan perubahan'}
      </button>

      {/* LAINNYA */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '12px' }}>LAINNYA</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '13px', color: '#000' }}>Ubah password</span><span style={{ fontSize: '13px', color: '#888' }}>→</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '13px', color: '#000' }}>Notifikasi WhatsApp</span><span style={{ fontSize: '13px', color: '#888' }}>→</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '13px', color: '#000' }}>Privasi & ketentuan</span><span style={{ fontSize: '13px', color: '#888' }}>→</span></div>
        </div>
      </div>

      {/* Keluar */}
      <button onClick={handleKeluar} style={{ width: '100%', padding: '12px', background: '#fff', color: '#000', border: '0.5px solid #e5e5e5', borderRadius: '4px', fontSize: '15px', fontWeight: '500', cursor: 'pointer', marginBottom: '16px' }}>
        Keluar
      </button>

      {/* Bottom Navigation */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '0.5px solid #e5e5e5', padding: '8px 16px 12px', maxWidth: '420px', margin: '0 auto', display: 'flex', justifyContent: 'space-around' }}>
        <Link href="/home" style={{ textDecoration: 'none', textAlign: 'center' }}><div style={{ textAlign: 'center', cursor: 'pointer' }}><div style={{ fontSize: '20px', filter: 'grayscale(1)' }}>🏠</div><div style={{ fontSize: '11px', fontWeight: '600', color: '#000', marginTop: '2px' }}>Home</div></div></Link>
        <Link href="/ranking" style={{ textDecoration: 'none', textAlign: 'center' }}><div style={{ textAlign: 'center', cursor: 'pointer' }}><div style={{ fontSize: '20px', filter: 'grayscale(1)' }}>🏆</div><div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>Ranking</div></div></Link>
        <Link href="/pertandingan" style={{ textDecoration: 'none', textAlign: 'center' }}><div style={{ textAlign: 'center', cursor: 'pointer' }}><div style={{ fontSize: '20px', filter: 'grayscale(1)' }}>⚔️</div><div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>Pertandingan</div></div></Link>
        <Link href="/akun" style={{ textDecoration: 'none', textAlign: 'center' }}><div style={{ textAlign: 'center', cursor: 'pointer' }}><div style={{ fontSize: '20px', filter: 'grayscale(1)' }}>👤</div><div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>Akun</div></div></Link>
      </div>
    </main>
  );
}