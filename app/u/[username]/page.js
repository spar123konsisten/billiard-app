// app/u/[username]/page.js
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

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

  // ===== 1. Ambil data user =====
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, nama, username, kota, foto_url, bio, lokasi_favorit')
    .eq('username', decodedUsername)
    .single();

  if (userError || !user) {
    notFound();
  }

  // ===== 2. Ambil rank user =====
  const { data: rankData } = await supabaseAdmin
    .from('rank')
    .select('tier, bintang, streak')
    .eq('user_id', user.id)
    .single();

  const tier = rankData?.tier || 'Rintis';
  const bintang = '★'.repeat(rankData?.bintang || 0);
  const streak = rankData?.streak || 0;

  // ===== 3. Ambil semua pertandingan yang melibatkan user (status done) =====
  const { data: matchesDone, error: matchError } = await supabaseAdmin
    .from('pertandingan')
    .select('id, challenger_id, challenged_id, tanggal, lokasi, waktu')
    .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
    .eq('status', 'done');

  let menang = 0;
  let kalah = 0;
  const history = [];

  if (matchesDone && !matchError && matchesDone.length > 0) {
    const matchIds = matchesDone.map(m => m.id);

    // ===== 4. Ambil semua skor (confirmed = true) =====
    const { data: allScores, error: scoreError } = await supabaseAdmin
      .from('skor')
      .select('match_id, input_by, skor_sendiri, skor_lawan')
      .in('match_id', matchIds)
      .eq('confirmed', true);

    if (!scoreError && allScores) {
      // ===== 5. Group skor berdasarkan match_id =====
      const scoreMap = {};
      for (const score of allScores) {
        if (!scoreMap[score.match_id]) {
          scoreMap[score.match_id] = [];
        }
        scoreMap[score.match_id].push(score);
      }

      // ===== 6. Hitung menang/kalah per match =====
      for (const match of matchesDone) {
        const scores = scoreMap[match.id] || [];
        if (scores.length === 0) continue;

        let winnerId = null;
        let skorText = '-';
        let hasil = 'Draw';

        if (scores.length === 1) {
          // Hanya satu skor, input_by adalah pemenang
          winnerId = scores[0].input_by;
          const isUserWin = winnerId === user.id;
          const skorUser = isUserWin ? scores[0].skor_sendiri : scores[0].skor_lawan;
          const skorLawan = isUserWin ? scores[0].skor_lawan : scores[0].skor_sendiri;
          skorText = `${skorUser}-${skorLawan}`;
          hasil = skorUser > skorLawan ? 'Menang' : (skorUser < skorLawan ? 'Kalah' : 'Draw');
        } else if (scores.length === 2) {
          // Dua skor, cari skor user dan lawan
          const userScore = scores.find(s => s.input_by === user.id);
          const oppScore = scores.find(s => s.input_by !== user.id);

          if (userScore && oppScore) {
            // Bandingkan skor_sendiri
            const userSkor = userScore.skor_sendiri;
            const oppSkor = oppScore.skor_sendiri;
            skorText = `${userSkor}-${oppSkor}`;
            if (userSkor > oppSkor) {
              winnerId = user.id;
              hasil = 'Menang';
            } else if (userSkor < oppSkor) {
              winnerId = oppScore.input_by;
              hasil = 'Kalah';
            } else {
              // Draw
              winnerId = null;
              hasil = 'Draw';
              skorText = `${userSkor}-${oppSkor}`;
            }
          } else {
            // Jika tidak ada skor user, ambil skor pertama
            winnerId = scores[0].input_by;
            const isUserWin = winnerId === user.id;
            const skorUser = isUserWin ? scores[0].skor_sendiri : scores[0].skor_lawan;
            const skorLawan = isUserWin ? scores[0].skor_lawan : scores[0].skor_sendiri;
            skorText = `${skorUser}-${skorLawan}`;
            hasil = skorUser > skorLawan ? 'Menang' : (skorUser < skorLawan ? 'Kalah' : 'Draw');
          }
        }

        // Update menang/kalah
        if (winnerId === user.id) {
          menang++;
        } else if (winnerId !== null && winnerId !== user.id) {
          kalah++;
        }

        // ===== 7. Simpan history untuk match terakhir =====
        // Kita akan ambil 3 match terakhir setelah loop selesai
        const lawanId = match.challenger_id === user.id ? match.challenged_id : match.challenger_id;
        const { data: lawanUser } = await supabaseAdmin
          .from('users')
          .select('nama, username')
          .eq('id', lawanId)
          .single();

        const { data: lawanRank } = await supabaseAdmin
          .from('rank')
          .select('tier, bintang')
          .eq('user_id', lawanId)
          .single();
        const lawanRankText = lawanRank ? `${lawanRank.tier} ${'★'.repeat(lawanRank.bintang)}` : '';

        // Simpan sementara untuk diurutkan nanti
        history.push({
          match,
          lawan: lawanUser?.nama || 'Unknown',
          lawanRank: lawanRankText,
          skor: skorText,
          hasil,
          tanggal: match.tanggal,
          lokasi: match.lokasi || '-',
          isWin: hasil === 'Menang',
        });
      }
    }
  }

  // ===== 8. Urutkan history berdasarkan tanggal terbaru dan ambil 3 =====
  history.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  const latestHistory = history.slice(0, 3);

  const totalMatch = menang + kalah;
  const winrate = totalMatch > 0 ? Math.round((menang / totalMatch) * 100) : 0;

  const currentUserId = await getCurrentUserId();
  const challengeLink = currentUserId
    ? `/ajak-sparring/${user.username}`
    : '/login';

  return (
    <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <a href="/home" style={{ display: 'inline-block', marginBottom: '24px', fontSize: '13px', color: '#888', textDecoration: 'none', borderBottom: '0.5px solid #e5e5e5', paddingBottom: '4px' }}>
        ← Kembali
      </a>

      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '36px', fontWeight: '700', letterSpacing: '2px', color: '#111' }}>{tier.toUpperCase()}</div>
        <div style={{ fontSize: '20px', letterSpacing: '4px', color: '#f5b042', marginTop: '4px' }}>{bintang}</div>
      </div>

      {streak > 0 && (
        <div style={{ textAlign: 'center', marginBottom: '20px', fontSize: '12px', color: '#666' }}>
          🔥 Streak {streak} menang berturut
        </div>
      )}

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

      {user.bio && (
        <div style={{ fontSize: '14px', lineHeight: '1.5', fontStyle: 'italic', color: '#555', textAlign: 'center', marginBottom: '24px', padding: '12px', background: '#fafafa', borderRadius: '4px' }}>
          "{user.bio}"
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase', color: '#aaa', marginBottom: '12px' }}>MATCH TERAKHIR</h2>
        {latestHistory.length === 0 && <p style={{ fontSize: '13px', color: '#888' }}>Belum ada match.</p>}
        {latestHistory.map((match, idx) => (
          <div key={idx} style={{ padding: '12px 0', borderBottom: idx < latestHistory.length - 1 ? '0.5px solid #e5e5e5' : 'none' }}>
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

      <Link href={challengeLink} style={{ textDecoration: 'none' }}>
        <button style={{ width: '100%', padding: '15px', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '15px', fontWeight: '500', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '16px' }}>
          <span>Challenge {user.nama}</span>
          <span>→</span>
        </button>
      </Link>

      <div style={{ fontSize: '12px', color: '#888', textAlign: 'center', padding: '8px 0' }}>
        sparring.id/u/{user.username}
      </div>
    </main>
  );
}