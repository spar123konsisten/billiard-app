'use client';
import { useEffect, useState } from 'react';

const INTENTS = [
  'get_top_rank','get_top_n','get_by_tier','get_by_city','get_by_tier_and_city',
  'get_top_n_by_tier_and_city','get_top_n_by_tier','get_top_n_by_city',
  'get_statistics','get_distribution','get_player_profile','get_recommendation',
  'compare_players','get_last_match','get_match_score',
];

const S = {
  page: { maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'inherit', color: '#171717' },
  h1: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  sub: { fontSize: 13, color: '#737373', marginBottom: 24 },
  card: { border: '1px solid #e5e5e5', borderRadius: 12, padding: 16, marginBottom: 20, background: '#fff' },
  h2: { fontSize: 15, fontWeight: 600, marginBottom: 12 },
  row: { display: 'flex', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0f0f0', flexWrap: 'wrap' },
  query: { flex: 1, minWidth: 200, fontSize: 14 },
  badge: (bg, color) => ({ background: bg, color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10 }),
  input: { padding: '6px 10px', border: '1px solid #e5e5e5', borderRadius: 8, fontSize: 13 },
  select: { padding: '6px 10px', border: '1px solid #e5e5e5', borderRadius: 8, fontSize: 13, background: '#fff' },
  btn: (bg) => ({ padding: '6px 12px', background: bg, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }),
  btnGhost: { padding: '6px 12px', background: '#fff', color: '#525252', border: '1px solid #e5e5e5', borderRadius: 8, fontSize: 12, cursor: 'pointer' },
  muted: { fontSize: 11, color: '#a3a3a3' },
};

export default function AiTrainingPage() {
  const [data, setData] = useState({ unknown: [], patterns: [] });
  const [loading, setLoading] = useState(true);
  const [intentSel, setIntentSel] = useState({});
  const [patternSel, setPatternSel] = useState({});
  const [form, setForm] = useState({ pattern: '', pattern_type: 'keyword', intent: INTENTS[0], priority: 0 });

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/ai-data');
    const json = await res.json();
    if (json.success) setData(json);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const act = async (payload) => {
    await fetch('/api/admin/ai-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    load();
  };

  const pending = data.unknown.filter(u => u.status === 'pending');

  return (
    <div style={S.page}>
      <h1 style={S.h1}>🧠 AI Training Dashboard</h1>
      <p style={S.sub}>Lihat pertanyaan yang belum dipahami AI, lalu ajarkan intent yang benar.</p>

      {/* ===== UNKNOWN QUERIES ===== */}
      <div style={S.card}>
        <h2 style={S.h2}>❓ Pertanyaan Belum Dipahami ({pending.length} pending)</h2>
        {loading ? <p style={S.muted}>Memuat...</p> : pending.length === 0 ? (
          <p style={S.muted}>Tidak ada pertanyaan pending. 🎉</p>
        ) : pending.map(u => (
          <div key={u.id} style={S.row}>
            <div style={S.query}>
              <strong>“{u.query}”</strong>
              <div style={S.muted}>
                ditanya {u.count}x • confidence {Number(u.confidence || 0).toFixed(2)}
                {u.intent_guess ? ` • tebakan: ${u.intent_guess}` : ''}
              </div>
            </div>
            <input
              style={S.input}
              placeholder="kata kunci, mis: jadwal main"
              value={patternSel[u.id] ?? ''}
              onChange={e => setPatternSel({ ...patternSel, [u.id]: e.target.value })}
            />
            <select
              style={S.select}
              value={intentSel[u.id] ?? ''}
              onChange={e => setIntentSel({ ...intentSel, [u.id]: e.target.value })}
            >
              <option value="">-- pilih intent --</option>
              {INTENTS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <button
              style={S.btn('#171717')}
              onClick={() => {
                const intent = intentSel[u.id]; const pattern = (patternSel[u.id] || '').trim();
                if (!intent || !pattern) { alert('Isi kata kunci DAN pilih intent dulu.'); return; }
                act({ action: 'map', id: u.id, intent, pattern });
              }}
            >Ajarkan</button>
            <button style={S.btnGhost} onClick={() => act({ action: 'ignore', id: u.id })}>Ignore</button>
          </div>
        ))}
      </div>

      {/* ===== LEARNED PATTERNS ===== */}
      <div style={S.card}>
        <h2 style={S.h2}>✅ Pola yang Sudah Diajarkan ({data.patterns.length})</h2>
        {data.patterns.map(p => (
          <div key={p.id} style={S.row}>
            <div style={S.query}>
              <strong>{p.pattern}</strong>{' '}
              <span style={S.badge('#f5f5f5', '#525252')}>{p.pattern_type}</span>{' '}
              <span style={S.badge('#171717', '#fff')}>→ {p.intent}</span>
              <div style={S.muted}>prioritas {p.priority}</div>
            </div>
            <button style={S.btnGhost} onClick={() => act({ action: 'toggle_pattern', id: p.id, active: !p.active })}>
              {p.active ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
            <button style={S.btn('#dc2626')} onClick={() => act({ action: 'delete_pattern', id: p.id })}>Hapus</button>
          </div>
        ))}
      </div>

      {/* ===== TAMBAH PATTERN MANUAL ===== */}
      <div style={S.card}>
        <h2 style={S.h2}>➕ Tambah Pattern Manual</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input style={S.input} placeholder="kata kunci / regex" value={form.pattern}
            onChange={e => setForm({ ...form, pattern: e.target.value })} />
          <select style={S.select} value={form.pattern_type}
            onChange={e => setForm({ ...form, pattern_type: e.target.value })}>
            <option value="keyword">keyword</option><option value="regex">regex</option><option value="exact">exact</option>
          </select>
          <select style={S.select} value={form.intent}
            onChange={e => setForm({ ...form, intent: e.target.value })}>
            {INTENTS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <input style={{ ...S.input, width: 70 }} type="number" value={form.priority}
            onChange={e => setForm({ ...form, priority: Number(e.target.value) })} />
          <button style={S.btn('#171717')} onClick={() => {
            if (!form.pattern.trim()) { alert('Pattern tidak boleh kosong.'); return; }
            act({ action: 'add_pattern', ...form });
            setForm({ pattern: '', pattern_type: 'keyword', intent: INTENTS[0], priority: 0 });
          }}>Simpan</button>
        </div>
      </div>

      <button style={S.btnGhost} onClick={load}>🔄 Refresh</button>
    </div>
  );
}