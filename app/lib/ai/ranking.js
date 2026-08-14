import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { TIER_ORDER, CITY_GROUPS } from './config.js';

// ===== IN-MEMORY CACHE =====
let cache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 15; // detik

// ===== FETCH ALL RANKING (dengan cache) =====
async function fetchAllRanking() {
  const now = Date.now();
  if (cache && (now - cacheTimestamp) < CACHE_TTL * 1000) {
    return cache;
  }

  try {
    // Fetch all rank data
    const { data: rankData } = await supabaseAdmin
      .from('rank')
      .select('user_id, tier, bintang, streak, poin');

    if (!rankData || rankData.length === 0) {
      cache = [];
      cacheTimestamp = now;
      return [];
    }

    // Get user ids
    const userIds = rankData.map(r => r.user_id);
    const { data: usersData } = await supabaseAdmin
      .from('users')
      .select('id, nama, username, kota, foto_url')
      .in('id', userIds);

    const userMap = {};
    usersData?.forEach(u => { userMap[u.id] = u; });

    // Merge data
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

// ===== GET RANKING (dengan filter) =====
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

  // Sort by tier_order DESC, bintang DESC
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

  const byTier = {};
  const byCity = {};

  for (const p of all) {
    const t = p.tier.toUpperCase();
    const c = p.kota || '(kosong)';
    byTier[t] = (byTier[t] || 0) + 1;
    byCity[c] = (byCity[c] || 0) + 1;
  }

  // Sort tier by TIER_ORDER
  const sortedTier = {};
  for (const tier of Object.keys(TIER_ORDER)) {
    const key = tier.toUpperCase();
    if (byTier[key]) sortedTier[key] = byTier[key];
  }

  const avgStars = total > 0 ? all.reduce((s, p) => s + p.bintang, 0) / total : 0;
  const avgStreak = total > 0 ? all.reduce((s, p) => s + p.streak, 0) / total : 0;

  // Sort city by count
  const sortedCity = Object.fromEntries(
    Object.entries(byCity).sort((a, b) => b[1] - a[1])
  );

  return {
    total,
    by_tier: sortedTier,
    by_city: sortedCity,
    avg_stars: Math.round(avgStars * 100) / 100,
    avg_streak: Math.round(avgStreak * 100) / 100,
  };
}

// ===== FIND PLAYER BY NAME =====
export function findPlayerByName(query) {
  const all = cache || [];
  const q = query.toLowerCase().trim();

  // Exact match
  for (const p of all) {
    if (p.nama_lower === q || p.username_lower === q) return p;
  }

  // Partial match
  for (const p of all) {
    if (p.nama_lower.includes(q) || p.username_lower.includes(q)) return p;
  }

  // Levenshtein (≤3)
  let best = null;
  let bestDist = Infinity;
  for (const p of all) {
    const d = levenshtein(q, p.nama_lower);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return (bestDist <= 3) ? best : null;
}

// ===== GET RECOMMENDATION =====
export async function getRecommendation(name) {
  const all = await fetchAllRanking();
  const ref = findPlayerByName(name);
  if (!ref) return { message: 'Pemain tidak ditemukan.', data: [] };

  const candidates = [];
  for (const p of all) {
    if (p.id === ref.id) continue;
    let score = 0;
    if (p.kota_lower === ref.kota_lower) score += 3;
    const diff = Math.abs(p.tier_order - ref.tier_order);
    if (diff === 0) score += 3;
    else if (diff === 1) score += 2;
    else if (diff === 2) score += 1;
    if (Math.abs(p.streak - ref.streak) <= 2) score += 1;
    candidates.push({ player: p, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, 3).map(c => ({ ...c.player, match_score: c.score }));
  return { message: `Rekomendasi lawan untuk ${ref.nama}:`, data: top };
}

// ===== CLEAR CACHE =====
export function clearRankingCache() {
  cache = null;
  cacheTimestamp = 0;
}

// ===== LEVENSHTEIN =====
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}