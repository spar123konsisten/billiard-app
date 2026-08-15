import { extractTier, extractCity, extractNumber, extractPlayerName, normalizeInput } from './nlp.js';
import { FILLER_WORDS, TIER_ORDER, TIER_SYNONYMS, CITY_GROUPS } from './config.js';


// ===== LEVENSHTEIN compact =====
function lev(a, b) {
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++)
      m[i][j] = b[i-1] === a[j-1]
        ? m[i-1][j-1]
        : Math.min(m[i-1][j-1]+1, m[i][j-1]+1, m[i-1][j]+1);
  return m[b.length][a.length];
}

// ===== Fuzzy keyword matcher =====
function hasFuzzy(text, keywords, maxDist = 1) {
  const words = text.split(/\s+/);
  for (const w of words) {
    if (w.length < 3) continue;
    for (const k of keywords) {
      if (w === k) return true;
      if (Math.abs(w.length - k.length) <= maxDist && lev(w, k) <= maxDist) return true;
    }
  }
  return false;
}

// ===== KATEGORI REKOMENDASI =====
const CORE_OPP = ['lawan','lwan','lawam','oponen','opponent'];
const STRONG_CTX = ['rekomendasi','rekomend','rekomen','rekomendasii',
                    'sparring','sparing','sparin','sparrin',
                    'partner','patner','partnerr','patnerr'];
const SOFT_CTX = ['cari','cariin','carikan','butuh','butu','perlu',
                  'kasih','kasihin','beri','berikan','ada',
                  'siapa','siappa','cocok','cocokk','pas','pass',
                  'setara','setra','setar','seimbang','seimban',
                  'tanding','tandig','tandingg','main','maen','mian',
                  'teman','temen','temann'];

function isRecommendIntent(clean) {
  const strong = hasFuzzy(clean, STRONG_CTX, 1);
  const core   = hasFuzzy(clean, CORE_OPP, 1);
  const soft   = hasFuzzy(clean, SOFT_CTX, 1);
  return strong || (core && soft);
}

// ===== EXTRACT NAMA TARGET REKOMENDASI =====
function extractRecommendationName(clean) {
  const skip = new Set([
    ...FILLER_WORDS,
    ...CORE_OPP, ...STRONG_CTX, ...SOFT_CTX,
    ...Object.keys(TIER_ORDER),
    ...Object.values(TIER_SYNONYMS).flat(),
    ...Object.keys(CITY_GROUPS).map(g => g.toLowerCase()),
    ...Object.values(CITY_GROUPS).flat(),
  ]);
  const words = clean.split(/\s+/).filter(w => w && !skip.has(w) && !/^\d+$/.test(w) && w.length >= 2);
  return words.length ? words.join(' ') : null;
}

// ===== PARSE INTENT =====
export function parseIntent(input) {
  const raw = normalizeInput(input);
  const words = raw.split(/\s+/).filter(w => w && !FILLER_WORDS.includes(w));
  const clean = words.join(' ');

  const tier = extractTier(clean);
  const city = extractCity(clean);
  const num = extractNumber(clean);
  const name = extractPlayerName(clean);

  const entities = {};
  if (tier) entities.tier = tier;
  if (city) entities.city = city;
  if (num) entities.limit = num;
  if (name) entities.name = name;

  let intent = null;

  // ===== DECISION TABLE =====
  if (clean.match(/(skor|score)\b/i)) {
    intent = 'get_match_score';
    const m = clean.match(/([a-z0-9]+)\s+(?:vs|lawan|sama|dengan)\s+([a-z0-9]+)/i);
    if (m) { entities.name1 = m[1]; entities.name2 = m[2]; }
  }
  else if (clean.match(/(terakhir|kemarin|lawan\s*siapa|main\s*sama\s*siapa|tanding\s*sama\s*siapa|riwayat)/i)) {
    intent = 'get_last_match';
  }
  else if (clean.match(/(berapa|hitung|jumlah|total)\b/i)) {
    intent = 'get_statistics';
  }
  else if (clean.match(/(distribusi|sebaran|breakdown|komposisi)/i)) {
    intent = 'get_distribution';
  }
  else if (clean.match(/(banding|\bvs\b|head\s*to\s*head|h2h)/i)) {
    intent = 'compare_players';
    const m = clean.match(/([a-z0-9]+)\s+(?:vs|lawan|sama|dengan)\s+([a-z0-9]+)/i);
    if (m) { entities.name1 = m[1]; entities.name2 = m[2]; }
  }
  // ✅ FIX: pakai fuzzy matcher, bukan regex lama
  else if (isRecommendIntent(clean)) {
    intent = 'get_recommendation';
    // Extract nama target (kalau ada). Kalau null → nanti pakai current user
    const targetName = extractRecommendationName(clean);
    if (targetName) entities.name = targetName;
  }
  else if (clean.match(/(peringkat|ranking|rank|juara|nomor)\s*(?:ke\s*-?\s*)?1\b/i) ||
           clean.match(/(peringkat|ranking|rank|juara|nomor)\s*(pertama|satu|teratas)/i)) {
    intent = 'get_top_rank';
    entities.limit = 1;
  }
  else if (clean.match(/top\s*(\d+)/i)) {
    intent = 'get_top_n';
    entities.limit = num || 5;
  }
  else if (clean.match(/(\d+)\s*(pemain|orang|jagoan)\s*(terbaik|terhebat|terbagus|jago|paling\s*(baik|bagus|jago|hebat))/i)) {
    intent = 'get_top_n';
    entities.limit = num || 5;
  }
  else if (clean.match(/(terbaik|terhebat|terbagus|jago|jagoan|paling\s*(baik|bagus|jago|hebat))/i)) {
    if (!entities.limit) entities.limit = 5;
    if (tier && city) intent = 'get_top_n_by_tier_and_city';
    else if (tier) intent = 'get_top_n_by_tier';
    else if (city) intent = 'get_top_n_by_city';
    else intent = 'get_top_n';
  }
  else if (tier && city && num) { intent = 'get_top_n_by_tier_and_city'; entities.limit = num; }
  else if (tier && city) { intent = 'get_by_tier_and_city'; }
  else if (tier && num && num > 1) { intent = 'get_top_n_by_tier'; entities.limit = num; }
  else if (city && num) { intent = 'get_top_n_by_city'; entities.limit = num; }
  else if (tier) { intent = 'get_by_tier'; }
  else if (city && clean.match(/(ada\s*siapa|siapa\s*aja|siapa\s*saja|pemain)/i)) { intent = 'get_by_city'; }
  else if (city) { intent = 'get_by_city'; }
  else if (num) { intent = 'get_top_n'; entities.limit = num; }
  else if (name) { intent = 'get_player_profile'; }

  // Fallback untuk riwayat
  if ((intent === 'get_last_match' || intent === 'get_match_score') && !entities.name && !entities.name1) {
    const n = extractFirstUnknownName(clean);
    if (n) entities.name = n;
  }

  const confidence = calculateConfidence(clean, entities);
  const debug = `tier=${tier || '-'} city=${city || '-'} num=${num || '-'} name=${name || '-'} conf=${confidence.toFixed(2)}`;

  return { intent, entities, confidence, debug };
}

// ===== EXTRACT UNKNOWN NAME (fallback) =====
function extractFirstUnknownName(clean) {
  const skip = [
    ...FILLER_WORDS,
    'terakhir', 'kemarin', 'lawan', 'main', 'tanding', 'skor', 'score', 'hasil', 'riwayat',
    'vs', 'sama', 'dengan', 'siapa', 'berapa', 'pertandingan', 'match', 'sparring', 'kali',
  ];
  const words = clean.split(/\s+/);
  for (const w of words) {
    if (w.length < 3) continue;
    if (skip.includes(w)) continue;
    if (/^\d+$/.test(w)) continue;
    return w;
  }
  return null;
}

// ===== CONFIDENCE SCORING =====
function calculateConfidence(input, entities) {
  let score = 0.3;
  if (entities.tier) score += 0.25;
  if (entities.city) score += 0.20;
  if (entities.limit) score += 0.10;
  if (entities.name) score += 0.15;
  if (input.length > 15) score += 0.05;
  const explicit = ['peringkat', 'ranking', 'siapa', 'top', 'tier', 'di', 'kota'];
  for (const kw of explicit) {
    if (input.includes(kw)) { score += 0.05; break; }
  }
  return Math.min(score, 1.0);
}

// ===== CONTEXT MEMORY =====
let context = null;

export function getContext() {
  return context;
}

export function setContext(intent, entities) {
  context = { intent, entities, time: Date.now() };
}

export function clearContext() {
  context = null;
}

// ===== CHECK FOLLOW-UP =====
export function isFollowUpQuery(input) {
  if (input.length < 25) {
    const markers = ['kalau', 'gimana', 'bagaimana', 'nah', 'lalu', 'terus', 'yang lain', 'lainnya', 'dia', 'mereka', 'yang itu', 'itu aja', 'sama aja', 'di ', 'yang '];
    for (const m of markers) {
      if (input.includes(m)) return true;
    }
  }
  return false;
}

// ===== MERGE WITH CONTEXT =====
export function mergeWithContext(input, currentEntities, currentIntent) {
  const ctx = getContext();
  if (!ctx) return { intent: currentIntent, entities: currentEntities, usedContext: false };

  const prev = ctx.entities;
  const merged = { ...currentEntities };

  const inp = input.toLowerCase();
  if (isFollowUpQuery(inp) && !currentIntent) {
    if (!merged.tier && prev.tier) merged.tier = prev.tier;
    if (!merged.city && prev.city) merged.city = prev.city;
    if (!merged.limit && prev.limit) merged.limit = prev.limit;
    if (!merged.name && prev.name) merged.name = prev.name;
    return { intent: ctx.intent, entities: merged, usedContext: true };
  }

  if (currentIntent === 'get_by_city' && prev.tier && !currentEntities.tier) {
    merged.tier = prev.tier;
    return { intent: 'get_by_tier_and_city', entities: merged, usedContext: true };
  }
  if (currentIntent === 'get_by_tier' && prev.city && !currentEntities.city) {
    merged.city = prev.city;
    return { intent: 'get_by_tier_and_city', entities: merged, usedContext: true };
  }

  return { intent: currentIntent, entities: merged, usedContext: false };
}