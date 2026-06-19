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

async function isAdmin(userId) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .single();
  return data?.is_admin === true;
}

export async function GET(req) {
  try {
    const userId = await getUserId();
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await isAdmin(userId))) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    // ===== CONFIRMED =====
    if (type === 'confirmed') {
      const { data: matches, error } = await supabaseAdmin
        .from('pertandingan')
        .select('id, tanggal, waktu, lokasi, created_at, challenger_id, challenged_id, copied_at')
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.error('Confirmed error:', error);
        return Response.json({ error: error.message }, { status: 500 });
      }

      const result = [];
      for (const m of matches) {
        const { data: challenger } = await supabaseAdmin
          .from('users')
          .select('nama')
          .eq('id', m.challenger_id)
          .single();
        const { data: challenged } = await supabaseAdmin
          .from('users')
          .select('nama')
          .eq('id', m.challenged_id)
          .single();

        result.push({
          id: m.id,
          tanggal: m.tanggal,
          waktu: m.waktu || '',
          lokasi: m.lokasi || '-',
          created_at: m.created_at,
          challenger: challenger?.nama || 'Unknown',
          challenged: challenged?.nama || 'Unknown',
          copied_at: m.copied_at,
        });
      }
      return Response.json(result);
    }

    // ===== RESULTS =====
    if (type === 'results') {
      // Ambil skor confirmed, tetapi kita akan ambil satu per match
      const { data: skorList, error } = await supabaseAdmin
        .from('skor')
        .select(`
          id, input_by, skor_sendiri, skor_lawan, copied_at,
          match:match_id (id, tanggal, waktu, lokasi, challenger_id, challenged_id, created_at)
        `)
        .eq('confirmed', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Results error:', error);
        return Response.json({ error: error.message }, { status: 500 });
      }

      // Kelompokkan berdasarkan match_id, ambil satu skor per match (yang pertama ditemukan)
      const matchMap = {};
      for (const skor of skorList) {
        const matchId = skor.match?.id;
        if (!matchId) continue;
        if (!matchMap[matchId]) {
          matchMap[matchId] = skor;
        }
      }

      const result = [];
      for (const matchId of Object.keys(matchMap)) {
        const skor = matchMap[matchId];
        const match = skor.match;
        if (!match) continue;

        const isChallengerWin = skor.input_by === match.challenger_id;
        const winnerId = skor.input_by;
        const loserId = isChallengerWin ? match.challenged_id : match.challenger_id;

        const { data: winner } = await supabaseAdmin
          .from('users')
          .select('nama')
          .eq('id', winnerId)
          .single();
        const { data: loser } = await supabaseAdmin
          .from('users')
          .select('nama')
          .eq('id', loserId)
          .single();

        const { data: rankData } = await supabaseAdmin
          .from('rank')
          .select('tier, bintang')
          .eq('user_id', winnerId)
          .single();

        const tierText = rankData ? `${rankData.tier} ${'★'.repeat(rankData.bintang)}` : '-';

        result.push({
          id: match.id,
          tanggal: match.tanggal,
          waktu: match.waktu || '',
          lokasi: match.lokasi || '-',
          created_at: match.created_at,
          pemenang: winner?.nama || 'Unknown',
          skor: `${skor.skor_sendiri}-${skor.skor_lawan}`,
          pecundang: loser?.nama || 'Unknown',
          tierBaru: tierText,
          copied_at: skor.copied_at,
          skorId: skor.id,
        });
      }

      // Urutkan berdasarkan created_at terbaru
      result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return Response.json(result);
    }

    return Response.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Admin matches error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ===== POST: mark as copied =====
export async function POST(req) {
  try {
    const userId = await getUserId();
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await isAdmin(userId))) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { type, id } = await req.json();
    if (!type || !id) {
      return Response.json({ error: 'type and id required' }, { status: 400 });
    }

    const table = type === 'match' ? 'pertandingan' : 'skor';
    const { error } = await supabaseAdmin
      .from(table)
      .update({ copied_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Update copied_at error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Mark copied error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}