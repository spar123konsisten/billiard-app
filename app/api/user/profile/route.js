import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

async function getUserIdFromToken() {
  const cookieStore = await cookies(); // note: cookies() mungkin async di Next.js 15+
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const userId = await getUserIdFromToken();
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, nama, username, no_wa, kota, lokasi_favorit, bio, foto_url')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return Response.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Ambil rank & poin
    const { data: rankData } = await supabaseAdmin
      .from('rank')
      .select('tier, bintang, poin')
      .eq('user_id', userId)
      .single();

    const rank = rankData ? `${rankData.tier} ${'★'.repeat(rankData.bintang)}` : 'Rintis ★';
    const poin = rankData?.poin || 0;

    return Response.json({
      id: user.id,
      namaLengkap: user.nama,
      username: user.username,
      no_wa: user.no_wa,
      kota: user.kota,
      lokasiFavorit: user.lokasi_favorit,
      bio: user.bio,
      fotoUrl: user.foto_url,
      rank,
      poin,
    });
  } catch (err) {
    console.error('Profile API error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const userId = await getUserIdFromToken();
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { namaLengkap, noWa, kota, lokasiFavorit, bio } = body;

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        nama: namaLengkap,
        no_wa: noWa,
        kota,
        lokasi_favorit: lokasiFavorit,
        bio,
      })
      .eq('id', userId);

    if (error) {
      console.error('Update error:', error);
      return Response.json({ error: 'Gagal update profil' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('PUT error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}