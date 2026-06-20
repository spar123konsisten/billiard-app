import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

async function getUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId;
  } catch { return null; }
}

function formatRelativeTime(date) {
  const diff = Math.floor((new Date() - date) / 60000);
  if (diff < 1) return 'baru saja';
  if (diff < 60) return `${diff} mnt`;
  if (diff < 1440) return `${Math.floor(diff / 60)} jam`;
  return `${Math.floor(diff / 1440)} hari`;
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Data user + rank
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        id, nama, username, kota, foto_url,
        rank:rank!inner (tier, bintang)
      `)
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    const user = {
      nama: userData.nama,
      username: userData.username,
      rank: `${userData.rank.tier} ${'★'.repeat(userData.rank.bintang)}`,
      kota: userData.kota,
      foto: userData.foto_url,
      seed: userData.id,
    };

    // 2. Jumlah ajakan (pending matches)
    const { count: jumlahAjakan } = await supabaseAdmin
      .from('pertandingan')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('challenged_id', userId);

    // 3. Player cari lawan (global, exclude self)
    const { data: playersData } = await supabaseAdmin
      .from('users')
      .select(`
        id, nama, username, kota, foto_url,
        rank:rank!inner (tier, bintang)
      `)
      .eq('verified', true)
      .neq('id', userId)
      .order('nama', { ascending: true });

    const players = playersData?.map(p => ({
      nama: p.nama,
      username: p.username,
      rank: `${p.rank.tier} ${'★'.repeat(p.rank.bintang)}`,
      kota: p.kota || '',
      seed: p.id,
      foto: p.foto_url,
    })) || [];

    // 4. Aktivitas terbaru (1 per match_id, confirmed true)
    const { data: scoresData } = await supabaseAdmin
      .from('skor')
      .select(`
        id,
        match_id,
        input_by,
        skor_sendiri,
        skor_lawan,
        created_at,
        match:match_id (
          id,
          challenger_id,
          challenged_id,
          tanggal,
          waktu,
          lokasi
        )
      `)
      .eq('confirmed', true)
      .order('created_at', { ascending: false })
      .limit(50); // ambil 50 skor terbaru

    // Kelompokkan berdasarkan match_id, ambil satu skor per match (yang pertama ditemukan)
    const matchMap = {};
    if (scoresData) {
      for (const score of scoresData) {
        const matchId = score.match_id;
        if (!matchMap[matchId]) {
          matchMap[matchId] = score;
        }
      }
    }

    const activities = [];
    for (const matchId of Object.keys(matchMap)) {
      const score = matchMap[matchId];
      const match = score.match;
      if (!match) continue;

      // Tentukan pemenang dan pecundang berdasarkan input_by
      const isChallengerWin = score.input_by === match.challenger_id;
      const winnerId = score.input_by;
      const loserId = isChallengerWin ? match.challenged_id : match.challenger_id;

      // Ambil nama pemenang dan pecundang
      const [winnerRes, loserRes] = await Promise.all([
        supabaseAdmin.from('users').select('nama, username').eq('id', winnerId).single(),
        supabaseAdmin.from('users').select('nama, username').eq('id', loserId).single(),
      ]);

      const winnerName = winnerRes.data?.nama || 'User';
      const loserName = loserRes.data?.nama || 'lawan';

      // Ambil rank pemenang
      const { data: rankData } = await supabaseAdmin
        .from('rank')
        .select('tier, bintang')
        .eq('user_id', winnerId)
        .single();
      const rankText = rankData ? `${rankData.tier} ${'★'.repeat(rankData.bintang)}` : '';

      activities.push({
        nama: winnerName,
        username: winnerRes.data?.username,
        aksi: `menang ${score.skor_sendiri}-${score.skor_lawan} vs ${loserName}`,
        rank: rankText,
        waktu: formatRelativeTime(new Date(score.created_at)),
        seed: winnerId,
      });
    }

    // Batasi activities ke 10 terbaru (sudah terurut dari query)
    const limitedActivities = activities.slice(0, 10);

    return Response.json({
      user,
      jumlahAjakan: jumlahAjakan || 0,
      players,
      activities: limitedActivities,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}