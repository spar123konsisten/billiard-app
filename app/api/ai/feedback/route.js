import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { query_id, fingerprint, feedback, reason } = await request.json();

    if (!['helpful', 'not_helpful'].includes(feedback)) {
      return NextResponse.json({ success: false, message: 'Feedback tidak valid.' }, { status: 400 });
    }

    const update = { feedback, feedback_at: new Date().toISOString() };
    if (feedback === 'not_helpful') update.feedback_reason = reason || null;

    let q = supabaseAdmin.from('unknown_queries').update(update);
    if (query_id) q = q.eq('id', query_id);
    else if (fingerprint) q = q.eq('fingerprint', fingerprint);
    else return NextResponse.json({ success: false, message: 'ID tidak ditemukan.' }, { status: 400 });

    const { error } = await q;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}