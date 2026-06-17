import { supabaseAdmin } from '@/lib/supabaseAdmin';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

// Helper: catat percobaan login
async function recordAttempt(ip, identifier, success) {
  await supabaseAdmin.from('login_attempts').insert({
    ip_address: ip,
    identifier: identifier || null,
    success: success,
  });
}

// Helper: cek rate limit (5 gagal dalam 15 menit)
async function isRateLimited(ip) {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const { count, error } = await supabaseAdmin
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .eq('success', false)
    .gte('attempted_at', fifteenMinutesAgo.toISOString());

  if (error) return false; // fallback
  return count >= 5;
}

export async function POST(req) {
  const JWT_SECRET = process.env.JWT_SECRET;
  
  // Pengecekan JWT_SECRET di dalam fungsi POST
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is missing! Check .env.local file.');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 });
  }

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return new Response(JSON.stringify({ error: 'Identifier dan password wajib diisi' }), { status: 400 });
    }

    // Rate limit check
    const limited = await isRateLimited(ip);
    if (limited) {
      return new Response(JSON.stringify({ error: 'Terlalu banyak percobaan, coba lagi nanti' }), { status: 429 });
    }

    // Cari user by no_wa atau username
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, username, no_wa, password_hash, verified')
      .or(`username.eq.${identifier.toLowerCase()},no_wa.eq.${identifier}`)
      .maybeSingle();

    // Jika user tidak ditemukan, tetap catat attempt gagal
    if (error || !user) {
      await recordAttempt(ip, identifier, false);
      // Delay untuk timing attack
      await new Promise(resolve => setTimeout(resolve, 500));
      return new Response(JSON.stringify({ error: 'No WA/username atau password salah' }), { status: 401 });
    }

    // Verifikasi password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      await recordAttempt(ip, identifier, false);
      await new Promise(resolve => setTimeout(resolve, 500));
      return new Response(JSON.stringify({ error: 'No WA/username atau password salah' }), { status: 401 });
    }

    // Cek verified
    if (!user.verified) {
      await recordAttempt(ip, identifier, false);
      return new Response(JSON.stringify({ error: 'Akun belum diverifikasi. Silakan cek WhatsApp.' }), { status: 403 });
    }

    // Login berhasil, catat success
    await recordAttempt(ip, identifier, true);

    // Buat JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set httpOnly cookie
    const cookie = serialize('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return new Response(JSON.stringify({ success: true, redirect: '/home' }), {
      status: 200,
      headers: { 'Set-Cookie': cookie },
    });
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: 'Terjadi kesalahan server' }), { status: 500 });
  }
}

export const runtime = 'nodejs';