import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { TIER_ORDER, CITY_GROUPS, CURRENT_USER_ID } from './config.js';
import { levenshtein } from './nlp.js';

// ===== IN-MEMORY CACHE =====
let cache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 15; // detik

// ===== FETCH ALL RANKING =====
async function fetchAllRanking() {
  const now = Date.now();
  if (cache && (now - cacheTimestamp) < CACHE_TTL * 1000) return cache;

  try {
    const { data: rankData } = await supabaseAdmin
      .from('rank')
      .select('user_id, tier, bintang, streak, poin');

    if (!rankData || rankData.length === 0) {
      cache = []; cacheTimestamp = now; return [];
    }

    const userIds = rankData.map(r => r.user_id);
    const { data: usersData } = await supabaseAdmin
      .from('users')
      .select('id, nama, username, kota, foto_url')
      .in('id', userIds);

    const userMap = {};
    usersData?.forEach(u => { userMap[u.id] = u; });

    const result = [];
    for (const rank of rankData) {
      const user = userMap[rank.user_id];
      if (!user) continue;
      result.push({
        id: rank.user_id,
        user_id: rank.user_id,
        nama: user.nama || 'Unknown',
        username: user.username || '',
        kota: user.kota || '',
        foto_url: user.foto_url || null,
        tier: rank.tier || 'rintis',
        bintang: rank.bintang || 0,
        streak: rank.streak || 0,
        poin: rank.poin || 0,
        tier_lower: (rank.tier || 'rintis').toLowerCase(),
        kota_lower: (user.kota || '').toLowerCase(),
        nama_lower: (user.nama || '').toLowerCase(),
        username_lower: (user.username || '').toLowerCase(),
        tier_order: TIER_ORDER[(rank.tier || 'rintis').toLowerCase()] || 0,
      });
    }

    cache = result;
    cacheTimestamp = now;
    return result;
  } catch (err) {
    console.error('fetchAllRanking error:', err);
    return cache || [];
  }
}

// ===== GET RANKING =====
export async function getRanking(filters = {}, limit = null) {
  let data = await fetchAllRanking();

  if (filters.tier) {
    const want = filters.tier.toLowerCase();
    data = data.filter(r => r.tier_lower === want);
  }
  if (filters.kota_aliases) {
    const aliases = filters.kota_aliases.map(a => a.toLowerCase());
    data = data.filter(r => aliases.includes(r.kota_lower));
  }
  if (filters.nama_like) {
    const q = filters.nama_like.toLowerCase();
    data = data.filter(r => r.nama_lower.includes(q) || r.username_lower.includes(q));
  }

  data.sort((a, b) => {
    if (a.tier_order !== b.tier_order) return b.tier_order - a.tier_order;
    return b.bintang - a.bintang;
  });

  if (limit && limit > 0) data = data.slice(0, limit);
  return data;
}

// ===== GET STATISTICS =====
export async function getStatistics() {
  const all = await fetchAllRanking();
  const total = all.length;

  const byTier = {}, byCity = {};
  for (const p of all) {
    const t = p.tier.toUpperCase();
    const c = p.kota || '(kosong)';
    byTier[t] = (byTier[t] || 0) + 1;
    byCity[c] = (byCity[c] || 0) + 1;
  }

  const sortedTier = {};
  for (const tier of Object.keys(TIER_ORDER)) {
    const key = tier.toUpperCase();
    if (byTier[key]) sortedTier[key] = byTier[key];
  }

  const avgStars = total > 0 ? all.reduce((s, p) => s + p.bintang, 0) / total : 0;
  const avgStreak = total > 0 ? all.reduce((s, p) => s + p.streak, 0) / total : 0;

  return {
    total,
    by_tier: sortedTier,
    by_city: Object.fromEntries(Object.entries(byCity).sort((a, b) => b[1] - a[1])),
    avg_stars: Math.round(avgStars * 100) / 100,
    avg_streak: Math.round(avgStreak * 100) / 100,
  };
}

// ===== FIND PLAYER BY NAME (pakai import levenshtein dari nlp.js) =====
export function findPlayerByName(query) {
  const all = cache || [];
  if (!query) return null;
  const q = query.toLowerCase().trim();

  for (const p of all)
    if (p.nama_lower === q || p.username_lower === q) return p;

  for (const p of all)
    if (p.nama_lower.includes(q) || p.username_lower.includes(q)) return p;

  let best = null, bestDist = Infinity;
  for (const p of all) {
    const d = levenshtein(q, p.nama_lower);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return bestDist <= 3 ? best : null;
}

// ===== FIND PLAYER BY ID (BARU — untuk riwayat) =====
export function findPlayerById(id) {
  if (!id) return null;
  const all = cache || [];
  return all.find(p => p.id === id || p.user_id === id) || null;
}

// ===== COMPARE PLAYERS (BARU) =====
export async function comparePlayers(name1, name2) {
  await fetchAllRanking();
  const p1 = findPlayerByName(name1);
  const p2 = findPlayerByName(name2);
  if (!p1 || !p2) {
    return { success: false, message: 'Saya tidak menemukan salah satu pemain. Pastikan nama benar.', data: [] };
  }

  let winner = null;
  if (p1.tier_order !== p2.tier_order) {
    winner = p1.tier_order > p2.tier_order ? p1.nama : p2.nama;
  } else if (p1.bintang !== p2.bintang) {
    winner = p1.bintang > p2.bintang ? p1.nama : p2.nama;
  } else if (p1.streak !== p2.streak) {
    winner = p1.streak > p2.streak ? p1.nama : p2.nama;
  } else {
    winner = 'SERI';
  }

  return {
    success: true,
    message: 'Perbandingan pemain:',
    data: [p1, p2],
    extra: { winner, type: 'comparison' },
  };
}

// ===== GET RECOMMENDATION (UPDATE: support current user fallback) =====
export async function getRecommendation(refName = null, cityFilter = null, limit = 3) {
  const all = await fetchAllRanking();

  // Filter kota eksplisit ("di jakarta")
  let pool = all;
  if (cityFilter) {
    const aliases = (CITY_GROUPS[cityFilter] || [cityFilter]).map(a => a.toLowerCase());
    pool = pool.filter(p => aliases.includes(p.kota_lower));
  }

  let ref = null;
  if (refName) {
    ref = findPlayerByName(refName);
    if (!ref) return { message: `Pemain "${refName}" tidak ditemukan.`, data: [] };
  }

  // ===== GUEST / tanpa referensi: return TOP sesuai pertanyaan =====
  if (!ref) {
    const sorted = [...pool].sort((a, b) =>
      a.tier_order !== b.tier_order ? b.tier_order - a.tier_order : b.bintang - a.bintang);
    return {
      message: 'Pemain teratas' + (cityFilter ? ` di ${cityFilter}` : '') + ':',
      data: sorted.slice(0, limit),
    };
  }

  // ===== LOGIN: scoring kemiripan =====
  const cand = [];
  for (const p of pool) {
    if (p.id === ref.id) continue;
    let s = 0;
    if (p.kota_lower === ref.kota_lower) s += 3;
    const d = Math.abs(p.tier_order - ref.tier_order);
    if (d === 0) s += 3; else if (d === 1) s += 2; else if (d === 2) s += 1;
    if (Math.abs(p.streak - ref.streak) <= 2) s += 1;
    cand.push({ player: p, score: s });
  }
  cand.sort((a, b) => b.score - a.score);
  return {
    message: `Rekomendasi lawan tanding untuk ${ref.nama}:`,
    data: cand.slice(0, limit).map(c => ({ ...c.player, match_score: c.score })),
  };
}

// ===== RIWAYAT TANDING (BARU) =====
const isDone = s => ['done', 'selesai', 'completed', 'finished']
  .includes(String(s || '').toLowerCase().trim());

function formatTanggal(d) {
  if (!d) return '';
  const t = new Date(d);
  return isNaN(t.getTime()) ? d : t.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getOpponentName(match, uid) {
  const oppId = match.challenger_id === uid ? match.challenged_id : match.challenger_id;
  const opp = findPlayerById(oppId);
  if (opp) return opp.nama;
  return match.guest_name || 'Tamu';
}

function buildMatchResponse(player, entry, match) {
  const oppId = match.challenger_id === player.id ? match.challenged_id : match.challenger_id;
  const opp = findPlayerById(oppId) || {
    nama: match.guest_name || 'Tamu', foto_url: '', tier: '',
    bintang: 0, streak: 0, kota: '', username: '',
  };

  const s1 = Number(entry.skor_sendiri) || 0;
  const s2 = Number(entry.skor_lawan) || 0;
  const winner = s1 > s2 ? player.nama : (s2 > s1 ? opp.nama : 'SERI');

  const info = [formatTanggal(match.tanggal), match.waktu, match.lokasi]
    .filter(Boolean).join(' • ');

  return {
    success: true,
    message: `Hasil pertandingan ${player.nama}:`,
    data: [player, opp],
    extra: { type: 'match_result', score1: s1, score2: s2, winner, info },
  };
}

async function getMatchesFor(uid) {
  try {
    const { data } = await supabaseAdmin
      .from('pertandingan')
      .select('*')
      .or(`challenger_id.eq.${uid},challenged_id.eq.${uid}`)
      .order('created_at', { ascending: false })
      .limit(20);
    return data || [];
  } catch (err) {
    console.error('getMatchesFor error:', err);
    return [];
  }
}

// ===== GET LAST MATCH (BARU) =====
export async function getLastMatch(name) {
  await fetchAllRanking();
  if (!name) return { _custom_message: 'Sebutkan nama pemainnya.' };

  const player = findPlayerByName(name);
  if (!player) return { _custom_message: `Pemain "${name}" tidak ditemukan.` };

  const all = await getMatchesFor(player.id);
  const done = all.find(m => isDone(m.status));

  if (done) {
    try {
      const { data } = await supabaseAdmin
        .from('skor')
        .select('*')
        .eq('match_id', done.id)
        .eq('input_by', player.id)
        .limit(1);
      if (data?.length) return buildMatchResponse(player, data[0], done);
    } catch (err) {
      console.error('getLastMatch skor error:', err);
    }
    return {
      _custom_message: `Pertandingan ${player.nama} vs ${getOpponentName(done, player.id)} (${formatTanggal(done.tanggal)}) sudah selesai tapi skor belum tercatat.`,
    };
  }

  if (!all.length) return { _custom_message: `${player.nama} belum punya riwayat pertandingan.` };

  const last = all[0];
  return {
    _custom_message: `${player.nama} belum punya pertandingan selesai. Terakhir dijadwalkan vs ${getOpponentName(last, player.id)} pada ${formatTanggal(last.tanggal)} (status: ${last.status}).`,
  };
}

// ===== GET MATCH SCORE (BARU) =====
export async function getMatchScore(name1, name2) {
  await fetchAllRanking();

  // Kasus 2 nama: head-to-head
  if (name1 && name2) {
    const p1 = findPlayerByName(name1);
    const p2 = findPlayerByName(name2);
    if (!p1 || !p2) return { _custom_message: 'Salah satu pemain tidak ditemukan.' };

    const all = await getMatchesFor(p1.id);
    const done = all.find(m =>
      [m.challenger_id, m.challenged_id].includes(p2.id) && isDone(m.status)
    );

    if (!done) {
      const any = all.find(m => [m.challenger_id, m.challenged_id].includes(p2.id));
      if (!any) return { _custom_message: `${p1.nama} dan ${p2.nama} belum pernah bertanding.` };
      return { _custom_message: `Pertandingan ${p1.nama} vs ${p2.nama} ada tapi belum selesai (status: ${any.status}).` };
    }

    try {
      const { data } = await supabaseAdmin
        .from('skor')
        .select('*')
        .eq('match_id', done.id)
        .eq('input_by', p1.id)
        .limit(1);
      if (data?.length) return buildMatchResponse(p1, data[0], done);
    } catch (err) {
      console.error('getMatchScore skor error:', err);
    }
    return {
      _custom_message: `Pertandingan ${p1.nama} vs ${p2.nama} (${formatTanggal(done.tanggal)}) sudah selesai tapi skor belum tercatat.`,
    };
  }

  // Kasus 1 nama: skor pertandingan selesai terakhir
  if (name1) return getLastMatch(name1);

  return { _custom_message: 'Sebutkan nama pemainnya.' };
}

// ===== CLEAR CACHE =====
export function clearRankingCache() {
  cache = null;
  cacheTimestamp = 0;
}