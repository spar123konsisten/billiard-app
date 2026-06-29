import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Token invalid' }, { status: 401 });
    }

    // Ambil user_id dari berbagai kemungkinan field
    const userId = decoded.user_id || decoded.id || decoded.sub || decoded.userId;
    if (!userId) {
      return NextResponse.json({ error: 'user_id tidak ditemukan di token' }, { status: 401 });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('nama, username, kota, foto_url')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User tidak ditemukan', detail: userError?.message }, { status: 404 });
    }

    const { data: rank } = await supabase
      .from('rank')
      .select('tier, bintang, streak')
      .eq('user_id', userId)
      .single();

    const { count: totalMatch } = await supabase
      .from('pertandingan')
      .select('*', { count: 'exact', head: true })
      .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
      .eq('status', 'done');

    const { count: totalMenang } = await supabase
      .from('skor')
      .select('*', { count: 'exact', head: true })
      .eq('input_by', userId)
      .eq('confirmed', true)
      .filter('skor_sendiri', 'gt', 'skor_lawan');

    const winrate = (totalMatch || 0) > 0
      ? Math.round(((totalMenang || 0) / totalMatch) * 100)
      : 0;

    const { data: kotaUserIds } = await supabase
      .from('users')
      .select('id')
      .eq('kota', user.kota);

    const ids = (kotaUserIds || []).map(u => u.id);

    const { data: kotaUsers } = ids.length > 0
      ? await supabase.from('rank').select('user_id, tier, bintang').in('user_id', ids)
      : { data: [] };

    const TIER_ORDER = ['rintis', 'isen', 'menteng', 'amok', 'tuah', 'maung', 'sura'];

    const sorted = (kotaUsers || []).sort((a, b) => {
      const tierDiff = TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier);
      if (tierDiff !== 0) return tierDiff;
      return (b.bintang || 0) - (a.bintang || 0);
    });

    const rank_kota = sorted.findIndex(u => u.user_id === userId) + 1;

    return NextResponse.json({
      nama: user.nama,
      username: user.username,
      kota: user.kota,
      foto_url: user.foto_url,
      tier: rank?.tier || 'rintis',
      bintang: rank?.bintang || 0,
      streak: rank?.streak || 0,
      winrate,
      rank_kota: rank_kota || 0,
    });

  } catch (err) {
    console.error('Error /api/user/me:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}