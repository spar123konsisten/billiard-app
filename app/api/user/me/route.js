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
    // 1. Ambil token dari cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('decoded JWT:', decoded); // ← tambah ini
    } catch {
      return NextResponse.json({ error: 'Token invalid' }, { status: 401 });
    }

    const userId = decoded.user_id;

    // 3. Ambil data user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('nama, username, kota, foto_url')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    // 4. Ambil rank
    const { data: rank } = await supabase
      .from('rank')
      .select('tier, bintang, streak')
      .eq('user_id', userId)
      .single();

    // 5. Hitung total match done
    const { count: totalMatch } = await supabase
      .from('pertandingan')
      .select('*', { count: 'exact', head: true })
      .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
      .eq('status', 'done');

    // 6. Hitung total menang dari table skor
    const { count: totalMenang } = await supabase
      .from('skor')
      .select('*', { count: 'exact', head: true })
      .eq('input_by', userId)
      .eq('confirmed', true)
      .filter('skor_sendiri', 'gt', 'skor_lawan');

    const winrate = totalMatch > 0
      ? Math.round((totalMenang / totalMatch) * 100)
      : 0;

    // 7. Hitung rank_kota
    // Ambil semua user di kota yang sama
    const { data: kotaUsers } = await supabase
      .from('rank')
      .select('user_id, tier, bintang')
      .in('user_id',
        (await supabase
          .from('users')
          .select('id')
          .eq('kota', user.kota)
        ).data?.map(u => u.id) || []
      );

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
  console.error('Error /api/user/me:', err.message, err.stack);
  return NextResponse.json({ error: err.message }, { status: 500 });
  console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
console.log('token exists:', !!token);
}

}