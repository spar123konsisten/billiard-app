import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// ⚠️ WAJIB: paksa route selalu dinamis, jangan di-cache saat build
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: ambil data dashboard
export async function GET() {
  try {
    const [{ data: unknowns, error: e1 }, { data: patterns, error: e2 }] = await Promise.all([
      supabaseAdmin.from('unknown_queries').select('*').order('count', { ascending: false }).limit(100),
      supabaseAdmin.from('learned_patterns').select('*').order('priority', { ascending: false }),
    ]);

    if (e1 || e2) {
      return NextResponse.json({ success: false, message: (e1 || e2).message }, { status: 500 });
    }

    return NextResponse.json({ success: true, unknown: unknowns || [], patterns: patterns || [] });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}

// POST: aksi admin (map / ignore / toggle / add / delete)
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, id } = body;

    if (action === 'map') {
      const { intent, pattern } = body;
      await supabaseAdmin.from('unknown_queries')
        .update({ status: 'mapped', mapped_intent: intent, mapped_at: new Date().toISOString() })
        .eq('id', id);
      await supabaseAdmin.from('learned_patterns').insert({
        pattern, pattern_type: 'keyword', intent, priority: 10, example_queries: [pattern],
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'ignore') {
      await supabaseAdmin.from('unknown_queries').update({ status: 'ignored' }).eq('id', id);
      return NextResponse.json({ success: true });
    }

    if (action === 'toggle_pattern') {
      await supabaseAdmin.from('learned_patterns').update({ active: body.active }).eq('id', id);
      return NextResponse.json({ success: true });
    }

    if (action === 'add_pattern') {
      const { pattern, pattern_type, intent, priority } = body;
      await supabaseAdmin.from('learned_patterns').insert({ pattern, pattern_type, intent, priority: priority || 0 });
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_pattern') {
      await supabaseAdmin.from('learned_patterns').delete().eq('id', id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak dikenal' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}