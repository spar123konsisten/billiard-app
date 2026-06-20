import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;

export async function middleware(request) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Halaman publik yang boleh diakses tanpa login
  const publicPaths = ['/login', '/register', '/', '/u/', '/verify'];
  const isPublic = publicPaths.some(path => pathname.startsWith(path));

  // Halaman yang butuh login
  const protectedPaths = ['/akun', '/home', '/dashboard', '/profil', '/pertandingan', '/ranking', '/cari-lawan', '/admin'];
  const isProtected = protectedPaths.some(path => pathname.startsWith(path));

  // Jika path public, lanjutkan
  if (isPublic) {
    return NextResponse.next();
  }

  // Jika path protected dan tidak ada token
  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Jika ada token, verifikasi JWT (opsional tapi lebih aman)
  if (isProtected && token) {
    try {
      const secret = new TextEncoder().encode(JWT_SECRET);
      await jwtVerify(token, secret);
      return NextResponse.next();
    } catch (err) {
      // Token invalid, hapus cookie dan redirect ke login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.set('token', '', {
        httpOnly: true,
        expires: new Date(0),
        path: '/',
      });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/akun/:path*',
    '/home/:path*',
    '/dashboard/:path*',
    '/profil/:path*',
    '/pertandingan/:path*',
    '/ranking/:path*',
    '/cari-lawan/:path*',
    '/admin/:path*',
    '/login',
    '/register',
  ],
};