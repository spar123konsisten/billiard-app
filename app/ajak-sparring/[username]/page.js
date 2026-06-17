import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import ChallengeForm from './ChallengeForm';

const JWT_SECRET = process.env.JWT_SECRET;

async function getCurrentUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId;
  } catch {
    return null;
  }
}

export default async function AjakSparringPage({ params }) {
  const { username } = await params;
  const decodedUsername = decodeURIComponent(username);
  const currentUserId = await getCurrentUserId();

  if (!currentUserId) {
    redirect('/login');
  }

  const { data: targetUser, error } = await supabaseAdmin
    .from('users')
    .select(`
      id, nama, username, kota, foto_url, lokasi_favorit,
      rank:rank!inner (tier, bintang)
    `)
    .eq('username', decodedUsername)
    .single();

  if (error || !targetUser) {
    notFound();
  }

  if (targetUser.id === currentUserId) {
    redirect('/home');
  }

  const rankText = `${targetUser.rank.tier} ${'★'.repeat(targetUser.rank.bintang)}`;
  const defaultLokasi = targetUser.lokasi_favorit || 'Tentukan lokasi';

  return (
    <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <Link href={`/u/${targetUser.username}`} style={{ display: 'inline-block', marginBottom: '16px', fontSize: '13px', color: '#888', textDecoration: 'none', borderBottom: '0.5px solid #e5e5e5', paddingBottom: '4px' }}>
        ← Profil {targetUser.nama}
      </Link>

      <h1 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '24px' }}>Ajak Sparring</h1>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>Tentukan waktu & lokasi dulu.</p>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', padding: '12px', background: '#f9f9f9', borderRadius: '8px' }}>
        <img
          src={targetUser.foto_url || `https://picsum.photos/seed/${targetUser.id}/50/50`}
          alt={targetUser.nama}
          style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }}
        />
        <div>
          <div style={{ fontWeight: '600' }}>{targetUser.nama}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>{rankText} · {targetUser.kota || ''}</div>
        </div>
      </div>

      <ChallengeForm
        challengedId={targetUser.id}
        username={targetUser.username}
        defaultLokasi={defaultLokasi}
      />

      <p style={{ fontSize: '12px', color: '#888', textAlign: 'center', marginTop: '16px' }}>
        {targetUser.nama} bisa terima atau tolak. Jam dikonfirmasi via WhatsApp.
      </p>
    </main>
  );
}