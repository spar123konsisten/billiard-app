import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('kota')
    .not('kota', 'is', null)
    .order('kota');

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const uniqueCities = [...new Set(data.map(item => item.kota))];
  return Response.json(uniqueCities);
}