import { supabaseAdmin } from '@/lib/supabaseAdmin';
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

export async function POST(req) {
  try {
    const challengerId = await getCurrentUserId();
    if (!challengerId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const formData = await req.formData();
    const challengedId = formData.get('challenged_id');
    const tanggal = formData.get('tanggal');
    const waktu = formData.get('waktu');
    const lokasi = formData.get('lokasi');

    if (!challengedId || !tanggal || !waktu || !lokasi) {
      return new Response(JSON.stringify({ error: 'Data tidak lengkap' }), { status: 400 });
    }

    // Insert pertandingan
    const { error: matchError } = await supabaseAdmin
      .from('pertandingan')
      .insert({
        challenger_id: challengerId,
        challenged_id: challengedId,
        status: 'pending',
        tanggal,
        waktu,
        lokasi,
      });

    if (matchError) {
      console.error('Insert match error:', matchError);
      return new Response(JSON.stringify({ error: 'Gagal mengirim ajakan' }), { status: 500 });
    }

    // Ambil data challenger untuk nama
    const { data: challengerData } = await supabaseAdmin
      .from('users')
      .select('nama')
      .eq('id', challengerId)
      .single();

    // Ambil data target (no_wa)
    const { data: targetData } = await supabaseAdmin
      .from('users')
      .select('no_wa')
      .eq('id', challengedId)
      .single();

    // Buat link WhatsApp tanpa token
    const challengerName = challengerData?.nama || 'Seseorang';
    
    // Format nomor WA
    let phoneNumber = targetData?.no_wa || '';
    phoneNumber = phoneNumber.replace(/\s|-/g, '');
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '62' + phoneNumber.slice(1);
    } else if (phoneNumber.startsWith('+62')) {
      phoneNumber = phoneNumber.slice(1);
    }

    const message = `Hai! ${challengerName} mengajakmu sparring pada ${tanggal} ${waktu} di ${lokasi}. Login ke aplikasi dan cek tab Ajakan.`;
    const waLink = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    // Redirect ke halaman pertandingan dengan parameter WA
    return new Response(null, {
      status: 303,
      headers: {
        Location: `/pertandingan?sent=true&wa=${encodeURIComponent(waLink)}`,
      },
    });
  } catch (err) {
    console.error('Server error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}