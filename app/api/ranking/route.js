import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

const tierOrder = {
  sura: 7,
  maung: 6,
  tuah: 5,
  amok: 4,
  menteng: 3,
  isen: 2,
  rintis: 1,
};

async function getUserIdFromToken() {
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

async function getLeaderboard(filterCity = null) {
  let query = supabaseAdmin
    .from('rank')
    .select(`
      user_id,
      tier,
      bintang,
      streak,
      poin,
      users!inner (
        id,
        nama,
        username,
        kota,
        foto_url
      )
    `);

  if (filterCity) {
    query = query.eq('users.kota', filterCity);
  }

  const { data, error } = await query;
  if (error) throw error;

  let players = data.map(item => ({
    id: item.users.id,
    nama: item.users.nama,
    username: item.users.username,
    kota: item.users.kota,
    foto_url: item.users.foto_url,
    tier: item.tier,
    bintang: item.bintang,
    streak: item.streak,
    poin: item.poin,
    tier_score: tierOrder[item.tier] || 0,
  }));

  players.sort((a, b) => {
    if (a.tier_score !== b.tier_score) return b.tier_score - a.tier_score;
    return b.bintang - a.bintang;
  });

  return players.map((p, idx) => ({ ...p, rank: idx + 1 }));
}

async function getWeeklyLeaderboard() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString();

  const { data: scores, error } = await supabaseAdmin
    .from('skor')
    .select('input_by, created_at')
    .eq('confirmed', true)
    .gte('created_at', sevenDaysAgoStr);

  if (error) throw error;

  const winCount = {};
  scores.forEach(score => {
    winCount[score.input_by] = (winCount[score.input_by] || 0) + 1;
  });

  const userIds = Object.keys(winCount);
  if (userIds.length === 0) return [];

  const { data: usersRank, error: userError } = await supabaseAdmin
    .from('rank')
    .select(`
      user_id,
      tier,
      bintang,
      streak,
      poin,
      users!inner (id, nama, username, kota, foto_url)
    `)
    .in('user_id', userIds);

  if (userError) throw userError;

  let players = usersRank.map(item => ({
    id: item.users.id,
    nama: item.users.nama,
    username: item.users.username,
    kota: item.users.kota,
    foto_url: item.users.foto_url,
    tier: item.tier,
    bintang: item.bintang,
    streak: item.streak,
    poin: item.poin,
    wins: winCount[item.user_id] || 0,
    tier_score: tierOrder[item.tier] || 0,
  }));

  players.sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.tier_score !== b.tier_score) return b.tier_score - a.tier_score;
    return b.bintang - a.bintang;
  });

  return players.map((p, idx) => ({ ...p, rank: idx + 1 }));
}

export async function GET(req) {
  try {
    const userId = await getUserIdFromToken();
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const tab = url.searchParams.get('tab') || 'nasional';
    const cityParam = url.searchParams.get('city') || null;

    let leaderboard = [];
    let userRankInfo = null;

    if (tab === 'nasional') {
      leaderboard = await getLeaderboard();
    } else if (tab === 'kota') {
      let filterCity = cityParam;
      if (!filterCity) {
        const { data: userData, error: userError } = await supabaseAdmin
          .from('users')
          .select('kota')
          .eq('id', userId)
          .single();
        if (userError) throw userError;
        filterCity = userData.kota;
      }
      if (!filterCity) {
        return Response.json({ error: 'User tidak memiliki kota' }, { status: 400 });
      }
      leaderboard = await getLeaderboard(filterCity);
    } else if (tab === 'mingguan') {
      leaderboard = await getWeeklyLeaderboard();
    } else {
      return Response.json({ error: 'Invalid tab' }, { status: 400 });
    }

    const userPos = leaderboard.findIndex(p => p.id === userId);
    if (userPos !== -1) {
      const userData = leaderboard[userPos];
      userRankInfo = {
        rank: userData.rank,
        nama: userData.nama,
        tier: `${userData.tier} ${'★'.repeat(userData.bintang)}`,
        streak: userData.streak,
        poin: userData.poin,
      };
    }

    const formattedLeaderboard = leaderboard.map(p => ({
      rank: p.rank,
      nama: p.nama,
      namaLengkap: p.username,
      kota: p.kota,
      foto: p.foto_url || `https://picsum.photos/seed/${p.id}/40/40`,
      tier: `${p.tier} ${'★'.repeat(p.bintang)}`,
      streak: p.streak,
      poin: p.poin,
      isUser: p.id === userId,
    }));

    return Response.json({
      userRank: userRankInfo,
      leaderboard: formattedLeaderboard,
    });
  } catch (error) {
    console.error('Ranking API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}