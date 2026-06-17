import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

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

function formatRelativeTime(date) {
  const diff = Math.floor((new Date() - date) / 60000);
  if (diff < 1) return 'baru saja';
  if (diff < 60) return `${diff} mnt`;
  if (diff < 1440) return `${Math.floor(diff / 60)} jam`;
  return `${Math.floor(diff / 1440)} hari`;
}

export async function GET() {
  try {
    const userId = await getUserIdFromToken();
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Data user + rank
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

    // Jumlah ajakan (pending matches)
    const { count: jumlahAjakan } = await supabaseAdmin
      .from('pertandingan')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('challenged_id', userId);

    // Semua pemain verified (global) kecuali diri sendiri
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

    // Aktivitas terbaru global (dari skor confirmed)
    const { data: scoresData } = await supabaseAdmin
      .from('skor')
      .select(`
        id, created_at,
        input_by, skor_sendiri, skor_lawan,
        match:pertandingan!inner (challenger_id, challenged_id)
      `)
      .eq('confirmed', true)
      .order('created_at', { ascending: false })
      .limit(20);

    const activities = [];
    if (scoresData) {
      for (const score of scoresData) {
        const opponentId = score.match.challenger_id === score.input_by 
          ? score.match.challenged_id 
          : score.match.challenger_id;
        
        const [winner, loser] = await Promise.all([
          supabaseAdmin.from('users').select('nama, username').eq('id', score.input_by).single(),
          supabaseAdmin.from('users').select('nama, username').eq('id', opponentId).single()
        ]);

        const winnerName = winner.data?.nama || 'User';
        const winnerUsername = winner.data?.username;
        const loserName = loser.data?.nama || 'lawan';

        const aksi = `menang ${score.skor_sendiri}-${score.skor_lawan} vs ${loserName}`;
        
        // Ambil rank pemenang (opsional)
        const { data: rankData } = await supabaseAdmin
          .from('rank')
          .select('tier, bintang')
          .eq('user_id', score.input_by)
          .single();
        const rankText = rankData ? `${rankData.tier} ${'★'.repeat(rankData.bintang)}` : '';

        activities.push({
          nama: winnerName,
          username: winnerUsername,
          aksi,
          rank: rankText,
          waktu: formatRelativeTime(new Date(score.created_at)),
          seed: score.input_by,
        });
      }
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