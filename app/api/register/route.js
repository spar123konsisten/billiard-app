import { supabaseAdmin } from '@/lib/supabaseAdmin';
import bcrypt from 'bcryptjs';

// Rate limiting sederhana (memory)
const rateLimit = new Map();

function getClientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  if (forwarded) return forwarded.split(',')[0];
  if (realIp) return realIp;
  return 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 jam
  const maxAttempts = 5;
  const record = rateLimit.get(ip);
  if (!record) {
    rateLimit.set(ip, { count: 1, firstAttempt: now });
    return false;
  }
  if (now - record.firstAttempt > windowMs) {
    rateLimit.set(ip, { count: 1, firstAttempt: now });
    return false;
  }
  if (record.count >= maxAttempts) {
    return true;
  }
  record.count++;
  rateLimit.set(ip, record);
  return false;
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

function isValidWhatsApp(noWa) {
  const cleaned = noWa.replace(/\s|-/g, '');
  return /^(08|\+62|62)[0-9]{8,14}$/.test(cleaned);
}

function isValidPassword(password) {
  return password && password.length >= 6;
}

export async function POST(req) {
  try {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: 'Terlalu banyak percobaan, coba lagi nanti' }), { status: 429 });
    }

    const { namaLengkap, nick, noWa, kota, lokasiFavorit, password } = await req.json();

    if (!nick || !noWa || !password) {
      return new Response(JSON.stringify({ error: 'Data tidak lengkap' }), { status: 400 });
    }

    const sanitizedNick = nick.trim().toLowerCase();
    const sanitizedNoWa = noWa.trim();
    const sanitizedNamaLengkap = namaLengkap ? namaLengkap.trim() : null;
    const sanitizedKota = kota ? kota.trim() : null;
    const sanitizedLokasi = lokasiFavorit ? lokasiFavorit.trim() : null;

    if (!isValidUsername(sanitizedNick)) {
      return new Response(JSON.stringify({ error: 'Username hanya boleh huruf, angka, underscore (3-20 karakter)' }), { status: 400 });
    }
    if (!isValidWhatsApp(sanitizedNoWa)) {
      return new Response(JSON.stringify({ error: 'Nomor WhatsApp tidak valid (contoh: 08xxxxxxxxx, 628xxxxxxxxx, atau +628xxxxxxxxx)' }), { status: 400 });
    }
    if (!isValidPassword(password)) {
      return new Response(JSON.stringify({ error: 'Password minimal 6 karakter' }), { status: 400 });
    }

    // Cek duplikat
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('users')
      .select('username, no_wa')
      .or(`username.eq.${sanitizedNick},no_wa.eq.${sanitizedNoWa}`)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: 'Username atau nomor WhatsApp sudah terdaftar' }), { status: 400 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert user
    const { data: user, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        nama: sanitizedNamaLengkap || sanitizedNick,
        username: sanitizedNick,
        no_wa: sanitizedNoWa,
        kota: sanitizedKota,
        lokasi_favorit: sanitizedLokasi,
        password_hash: passwordHash,
        verified: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Registrasi gagal, coba lagi' }), { status: 500 });
    }

    // Generate token verifikasi
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { error: tokenError } = await supabaseAdmin
      .from('verification_tokens')
      .insert({
        user_id: user.id,
        token: token,
        expires_at: expiresAt.toISOString(),
        used: false,
      });

    if (tokenError) console.error('Token insert error:', tokenError);

    return new Response(JSON.stringify({ message: 'Pendaftaran berhasil, tunggu verifikasi' }), { status: 200 });
  } catch (error) {
    console.error('Server error:', error);
    return new Response(JSON.stringify({ error: 'Terjadi kesalahan server' }), { status: 500 });
  }
}

export const runtime = 'nodejs';