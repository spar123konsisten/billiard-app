import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return Response.json({ error: 'No token' });

  let userId = null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.userId;
  } catch(e) { return Response.json({ error: e.message }); }

  if (!userId) return Response.json({ error: 'No userId' });

  const { data, error } = await supabaseAdmin
    .from('pertandingan')
    .select('*')
    .eq('challenged_id', userId)
    .eq('status', 'pending');

  return Response.json({ userId, data, error });
}