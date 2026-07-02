// ========== FILE: app/api/dashboard/route.js ==========
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
  const diff = Math.floor((new Date() - new Date(date)) / 60000);
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
      .select('id, nama, username, kota, foto_url')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    const { data: rankData } = await supabaseAdmin
      .from('rank')
      .select('tier, bintang')
      .eq('user_id', userId)
      .single();

    const user = {
      nama: userData.nama,
      username: userData.username,
      rank: rankData ? `${rankData.tier} ${'★'.repeat(rankData.bintang || 0)}` : 'Rintis',
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
      .select('id, nama, username, kota, foto_url')
      .eq('verified', true)
      .neq('id', userId)
      .order('nama', { ascending: true });

    // Ambil rank untuk semua player
    const playerIds = playersData?.map(p => p.id) || [];
    const { data: playerRanks } = await supabaseAdmin
      .from('rank')
      .select('user_id, tier, bintang')
      .in('user_id', playerIds);

    const rankMap = {};
    playerRanks?.forEach(r => {
      rankMap[r.user_id] = `${r.tier} ${'★'.repeat(r.bintang || 0)}`;
    });

    const players = playersData?.map(p => ({
      nama: p.nama,
      username: p.username,
      rank: rankMap[p.id] || 'Rintis',
      kota: p.kota || '',
      seed: p.id,
      foto: p.foto_url,
    })) || [];

    // 4. Aktivitas terbaru - 1 per match, hanya pemenang
    const { data: scoresData } = await supabaseAdmin
      .from('skor')
      .select('id, match_id, input_by, skor_sendiri, skor_lawan, created_at')
      .eq('confirmed', true)
      .order('created_at', { ascending: false })
      .limit(50);

    // Ambil semua match_id unik
    const matchIds = [...new Set(scoresData?.map(s => s.match_id) || [])];
    const { data: matches } = await supabaseAdmin
      .from('pertandingan')
      .select('id, challenger_id, challenged_id')
      .in('id', matchIds);

    const matchMap = {};
    matches?.forEach(m => { matchMap[m.id] = m; });

    // Ambil semua user_id yang terlibat
    const userIds = new Set();
    for (const score of scoresData || []) {
      userIds.add(score.input_by);
      const match = matchMap[score.match_id];
      if (match) {
        userIds.add(match.challenger_id);
        userIds.add(match.challenged_id);
      }
    }

    // Ambil data user dan rank
    const { data: usersData } = await supabaseAdmin
      .from('users')
      .select('id, nama, foto_url')
      .in('id', [...userIds]);

    const { data: ranksData } = await supabaseAdmin
      .from('rank')
      .select('user_id, tier, bintang')
      .in('user_id', [...userIds]);

    const userMap = {};
    usersData?.forEach(u => { userMap[u.id] = u; });

    const rankMapAll = {};
    ranksData?.forEach(r => {
      rankMapAll[r.user_id] = `${r.tier} ${'★'.repeat(r.bintang || 0)}`;
    });

    const activities = [];
    const processedMatches = new Set();

    for (const score of scoresData || []) {
      const match = matchMap[score.match_id];
      if (!match) continue;
      if (processedMatches.has(score.match_id)) continue;

      // Tentukan pemenang (skor_sendiri > skor_lawan)
      if (score.skor_sendiri <= score.skor_lawan) continue;

      const winnerId = score.input_by;
      const loserId = match.challenger_id === winnerId ? match.challenged_id : match.challenger_id;

      const winner = userMap[winnerId];
      const loser = userMap[loserId];
      if (!winner || !loser) continue;

      activities.push({
        nama: winner.nama,
        winnerRank: rankMapAll[winnerId] || '-',
        skorSendiri: score.skor_sendiri,
        skorLawan: score.skor_lawan,
        lawanNama: loser.nama,
        loserRank: rankMapAll[loserId] || '-',
        waktu: formatRelativeTime(score.created_at),
        seed: winnerId,
        foto: winner.foto_url,
        lawanId: loserId,
        lawanFoto: loser.foto_url,
      });

      processedMatches.add(score.match_id);
      if (activities.length >= 10) break;
    }

    return Response.json({
      user,
      jumlahAjakan: jumlahAjakan || 0,
      players,
      activities,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}