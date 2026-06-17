// app/u/[username]/page.js
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// Helper untuk mengecek apakah user login (opsional, untuk tombol challenge)
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

// Helper untuk format tanggal relatif
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hari ini';
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hari lalu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu lalu`;
  return `${Math.floor(diffDays / 30)} bulan lalu`;
}

export default async function UserProfilePage({ params }) {
  const { username } = await params;
  const decodedUsername = decodeURIComponent(username);

  // Ambil data user dari database (tanpa auth)
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select(`
      id, nama, username, kota, foto_url, bio, lokasi_favorit,
      rank:rank!inner (tier, bintang, streak)
    `)
    .eq('username', decodedUsername)
    .single();

  if (error || !user) {
    notFound();
  }

  // Hitung statistik menang/kalah dari pertandingan dengan status 'done'
  const { data: matchResults, error: statsError } = await supabaseAdmin
    .from('skor')
    .select(`
      id, match_id, input_by, skor_sendiri, skor_lawan,
      match:pertandingan!inner (
        challenger_id, challenged_id, status, tanggal
      )
    `)
    .eq('confirmed', true)
    .eq('match.status', 'done')
    .or(`input_by.eq.${user.id},match.challenger_id.eq.${user.id},match.challenged_id.eq.${user.id}`);

  let menang = 0, kalah = 0;
  if (matchResults && !statsError) {
    const userMatches = matchResults.filter(m => 
      m.match.challenger_id === user.id || m.match.challenged_id === user.id
    );
    for (const match of userMatches) {
      if (match.input_by === user.id) {
        menang++;
      } else {
        kalah++;
      }
    }
  }

  const totalMatch = menang + kalah;
  const winrate = totalMatch > 0 ? Math.round((menang / totalMatch) * 100) : 0;

  // Riwayat match terakhir (3 match)
  const { data: recentMatches, error: matchError } = await supabaseAdmin
    .from('pertandingan')
    .select(`
      id, tanggal, lokasi, waktu,
      challenger_id, challenged_id,
      skor!inner (input_by, skor_sendiri, skor_lawan, confirmed)
    `)
    .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
    .eq('status', 'done')
    .order('tanggal', { ascending: false })
    .limit(3);

  const history = [];
  if (recentMatches && !matchError) {
    for (const match of recentMatches) {
      const lawanId = match.challenger_id === user.id ? match.challenged_id : match.challenger_id;
      const { data: lawanData } = await supabaseAdmin
        .from('users')
        .select('nama, username')
        .eq('id', lawanId)
        .single();
      
      const skor = match.skor?.find(s => s.confirmed === true);
      const skorUser = skor?.input_by === user.id ? skor.skor_sendiri : skor.skor_lawan;
      const skorLawan = skor?.input_by === user.id ? skor.skor_lawan : skor.skor_sendiri;
      const hasil = skorUser > skorLawan ? 'Menang' : (skorUser < skorLawan ? 'Kalah' : 'Draw');
      const skorText = `${skorUser}-${skorLawan}`;

      const { data: lawanRank } = await supabaseAdmin
        .from('rank')
        .select('tier, bintang')
        .eq('user_id', lawanId)
        .single();
      const lawanRankText = lawanRank ? `${lawanRank.tier} ${'★'.repeat(lawanRank.bintang)}` : '';

      history.push({
        lawan: lawanData?.nama || 'Unknown',
        lawanRank: lawanRankText,
        skor: skorText,
        hasil,
        tanggal: match.tanggal,
        lokasi: match.lokasi,
        waktu: match.waktu,
        isWin: hasil === 'Menang'
      });
    }
  }

  const tier = user.rank.tier;
  const bintang = '★'.repeat(user.rank.bintang);
  const streak = user.rank.streak;

  const currentUserId = await getCurrentUserId();
  const challengeLink = currentUserId 
    ? `/ajak-sparring/${user.username}` 
    : '/login';

  return (
    <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      {/* Tombol kembali */}
      <a href="/" style={{ display: 'inline-block', marginBottom: '24px', fontSize: '13px', color: '#888', textDecoration: 'none', borderBottom: '0.5px solid #e5e5e5', paddingBottom: '4px' }}>
        ← Kembali
      </a>

      {/* Tier besar di atas */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '36px', fontWeight: '700', letterSpacing: '2px', color: '#111' }}>{tier.toUpperCase()}</div>
        <div style={{ fontSize: '20px', letterSpacing: '4px', color: '#f5b042', marginTop: '4px' }}>{bintang}</div>
      </div>

      {/* Streak & posisi */}
      {streak > 0 && (
        <div style={{ textAlign: 'center', marginBottom: '20px', fontSize: '12px', color: '#666' }}>
          🔥 Streak {streak} menang berturut
        </div>
      )}

      {/* Foto + nama + kota + lokasi favorit */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
        <img
          src={user.foto_url || `https://picsum.photos/seed/${user.id}/80/80`}
          alt={user.nama}
          style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover' }}
        />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 4px' }}>{user.nama}</h1>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '2px' }}>{user.username}</div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '2px' }}>{user.kota || '-'}</div>
          {user.lokasi_favorit && (
            <div style={{ fontSize: '12px', color: '#888' }}>📍 {user.lokasi_favorit}</div>
          )}
        </div>
      </div>

      {/* Stats card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '24px' }}>
        <div style={{ border: '0.5px solid #e5e5e5', borderRadius: '4px', padding: '12px', textAlign: 'center', background: '#f9f9f9' }}>
          <div style={{ fontSize: '24px', fontWeight: '600' }}>{menang}</div>
          <div style={{ fontSize: '11px', color: '#888' }}>MENANG</div>
        </div>
        <div style={{ border: '0.5px solid #e5e5e5', borderRadius: '4px', padding: '12px', textAlign: 'center', background: '#f9f9f9' }}>
          <div style={{ fontSize: '24px', fontWeight: '600' }}>{kalah}</div>
          <div style={{ fontSize: '11px', color: '#888' }}>KALAH</div>
        </div>
        <div style={{ border: '0.5px solid #e5e5e5', borderRadius: '4px', padding: '12px', textAlign: 'center', background: '#f9f9f9' }}>
          <div style={{ fontSize: '24px', fontWeight: '600' }}>{winrate}%</div>
          <div style={{ fontSize: '11px', color: '#888' }}>WINRATE</div>
        </div>
      </div>

      {/* Bio */}
      {user.bio && (
        <div style={{ fontSize: '14px', lineHeight: '1.5', fontStyle: 'italic', color: '#555', textAlign: 'center', marginBottom: '24px', padding: '12px', background: '#fafafa', borderRadius: '4px' }}>
          "{user.bio}"
        </div>
      )}

      {/* Match terakhir */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', color: '#aaa', marginBottom: '12px' }}>MATCH TERAKHIR</h2>
        {history.length === 0 && <p style={{ fontSize: '13px', color: '#888' }}>Belum ada match.</p>}
        {history.map((match, idx) => (
          <div key={idx} style={{ padding: '12px 0', borderBottom: idx < history.length-1 ? '0.5px solid #e5e5e5' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontWeight: '600', fontSize: '14px' }}>vs {match.lawan} · {match.lawanRank}</span>
              <span style={{ fontSize: '11px', color: '#aaa' }}>{formatDate(match.tanggal)}</span>
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{match.lokasi}</div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: match.isWin ? '#1D9E75' : '#D32F2F' }}>
              {match.hasil} {match.skor}
            </div>
          </div>
        ))}
      </div>

      {/* Tombol Challenge */}
      <Link href={challengeLink} style={{ textDecoration: 'none' }}>
        <button style={{ width: '100%', padding: '15px', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '15px', fontWeight: '500', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '16px' }}>
          <span>Challenge {user.nama}</span>
          <span>→</span>
        </button>
      </Link>

      {/* Link profil */}
      <div style={{ fontSize: '12px', color: '#888', textAlign: 'center', padding: '8px 0' }}>
        sparring.id/u/{user.username}
      </div>
    </main>
  );
}