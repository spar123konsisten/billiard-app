import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // Hapus cookie httpOnly dengan cara yang benar
  response.cookies.set('token', '', {
    httpOnly: true,
    expires: new Date(0), // langsung expired
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  
  return response;
}