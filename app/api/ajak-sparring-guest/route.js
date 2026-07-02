import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { challenged_id, guest_name, guest_phone, tanggal, waktu, lokasi } = body;

    // Validasi
    if (!challenged_id || !guest_name || !guest_phone || !tanggal || !waktu || !lokasi) {
      return NextResponse.json(
        { error: 'Semua field wajib diisi' },
        { status: 400 }
      );
    }

    // Validasi nomor WA (hanya angka)
    if (!/^[0-9]+$/.test(guest_phone)) {
      return NextResponse.json(
        { error: 'Nomor WhatsApp hanya boleh angka' },
        { status: 400 }
      );
    }

    // Insert ke tabel pertandingan dengan challenger_id = null (guest)
    const { data, error } = await supabaseAdmin
      .from('pertandingan')
      .insert({
        challenger_id: null,          // guest tidak punya ID
        challenged_id: challenged_id,
        status: 'pending',
        tanggal,
        waktu,
        lokasi,
        guest_name,
        guest_phone,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Insert guest challenge error:', error);
      return NextResponse.json(
        { error: 'Gagal menyimpan data: ' + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Challenge berhasil dikirim!',
    });

  } catch (error) {
    console.error('Error /api/ajak-sparring-guest:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}