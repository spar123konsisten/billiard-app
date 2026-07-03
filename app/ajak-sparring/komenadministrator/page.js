// app/ajak-sparring/administrator/page.js
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Link from 'next/link';
import ChallengeForm from './ChallengeForm';

export default async function AjakSparringAdministratorPage() {
  // Ambil data administrator
  const { data: admin, error: adminError } = await supabaseAdmin
    .from('users')
    .select('id, nama, username, kota, foto_url, lokasi_favorit')
    .eq('username', 'administrator')
    .single();

  if (adminError || !admin) {
    return (
      <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
        <h1>Administrator tidak ditemukan</h1>
        <Link href="/">Kembali ke Beranda</Link>
      </main>
    );
  }

  const defaultLokasi = admin.lokasi_favorit || 'Tentukan lokasi';

  return (
    <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <Link href="/u/administrator" style={{ display: 'inline-block', marginBottom: '24px', fontSize: '13px', color: '#888', textDecoration: 'none', borderBottom: '0.5px solid #e5e5e5', paddingBottom: '4px' }}>
        ← Kembali ke Profil Administrator
      </Link>

      <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Ajak Sparring Administrator</h1>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>
        Kirim tantangan ke Administrator. Tidak perlu login.
      </p>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', padding: '12px', background: '#f9f9f9', borderRadius: '8px' }}>
        <img
          src={admin.foto_url || `https://picsum.photos/seed/${admin.id}/50/50`}
          alt={admin.nama}
          style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }}
        />
        <div>
          <div style={{ fontWeight: '600' }}>{admin.nama}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>⭐ Official Account · {admin.kota || ''}</div>
        </div>
      </div>

      <ChallengeForm
        challengedId={admin.id}
        defaultLokasi={defaultLokasi}
      />

      <p style={{ fontSize: '12px', color: '#888', textAlign: 'center', marginTop: '16px' }}>
        Setelah kirim, Anda akan diarahkan ke profil Administrator dan WhatsApp akan terbuka.
      </p>
    </main>
  );
}