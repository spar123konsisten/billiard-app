import { TIER_ORDER, TIER_SYNONYMS, CITY_GROUPS, FILLER_WORDS } from './config.js';

// ===== NORMALIZE =====
export function normalizeInput(input) {
  let text = input
    .toLowerCase()
    .replace(/(.)\1{2,}/g, '$1') // remove repeated chars
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

// ===== IS SUBSEQUENCE =====
function isSubsequence(needle, haystack) {
  let pos = 0;
  for (let i = 0; i < haystack.length && pos < needle.length; i++) {
    if (haystack[i] === needle[pos]) pos++;
  }
  return pos === needle.length;
}

// ===== EXTRACT TIER =====
export function extractTier(input) {
  const text = normalizeInput(input);
  const tiers = Object.keys(TIER_ORDER);

  // Check synonyms
  for (const [canonical, synonyms] of Object.entries(TIER_SYNONYMS)) {
    for (const syn of synonyms) {
      if (syn.length >= 3 && text.includes(syn)) return canonical;
    }
  }

  // Check exact tier names
  for (const tier of tiers) {
    if (text.includes(tier)) return tier;
  }

  // Check levenshtein (≤2)
  const words = text.split(/\s+/);
  for (const word of words) {
    if (word.length < 3) continue;
    for (const tier of tiers) {
      if (tier.length >= 3 && levenshtein(word, tier) <= 2) return tier;
      for (const syn of TIER_SYNONYMS[tier]) {
        if (syn.length >= 3 && levenshtein(word, syn) <= 2) return tier;
      }
    }
  }

  // Check subsequence
  for (const word of words) {
    if (word.length < 4) continue;
    for (const tier of tiers) {
      if (tier.length >= 4 && isSubsequence(tier, word)) return tier;
    }
  }

  return null;
}

// ===== EXTRACT CITY =====
export function extractCity(input) {
  const text = normalizeInput(input);

  for (const [group, aliases] of Object.entries(CITY_GROUPS)) {
    for (const alias of aliases) {
      if (text.includes(alias)) return group;
    }
  }

  const words = text.split(/\s+/);
  for (const word of words) {
    if (word.length < 3) continue;
    for (const [group, aliases] of Object.entries(CITY_GROUPS)) {
      for (const alias of aliases) {
        if (alias.length >= 3 && levenshtein(word, alias) <= 1) return group;
      }
    }
  }

  return null;
}

// ===== EXTRACT NUMBER =====
export function extractNumber(input) {
  let match;

  // "top N"
  if ((match = input.match(/top\s*(\d+)/i))) return parseInt(match[1]);
  // "N pemain/orang/teratas"
  if ((match = input.match(/(\d+)\s*(pemain|orang|besar|teratas)/i))) return parseInt(match[1]);
  // "peringkat/ranking ke N"
  if ((match = input.match(/(peringkat|ranking|rank|nomor|juara)\s*(ke\s*-?\s*)?(\d+)/i))) return parseInt(match[3]);
  // "pertama/satu"
  if (input.match(/(peringkat|ranking|rank|nomor|juara)\s*(pertama|satu|teratas|atas)/i)) return 1;
  if (input.match(/\b(1|satu|pertama)\b/i)) return 1;

  return null;
}

// ===== EXTRACT PLAYER NAME =====
export function extractPlayerName(input) {
  const text = normalizeInput(input);
  const words = text.split(/\s+/);

  // Build skip list
  const skip = new Set([
    ...FILLER_WORDS,
    ...Object.keys(TIER_ORDER),
    ...Object.values(TIER_SYNONYMS).flat(),
    ...Object.values(CITY_GROUPS).flat(),
    ...Object.keys(CITY_GROUPS).map(g => g.toLowerCase()),
    'top', 'peringkat', 'ranking', 'rank', 'juara', 'nomor', 'vs', 'lawan',
    'dengan', 'sama', 'pemain', 'user', 'nama', 'profile', 'profil', 'cari',
    'tentang', 'siapa', 'ada', 'the',
  ]);

  const keywords = ['pemain', 'user', 'nama', 'profile', 'profil', 'cari', 'tentang', 'vs', 'lawan', 'dengan', 'sama'];
  let captured = [];
  let capture = false;

  for (const word of words) {
    if (skip.has(word)) { capture = false; continue; }
    if (capture && /^[a-z0-9]+$/.test(word)) captured.push(word);
    if (keywords.includes(word)) capture = true;
  }

  return captured.length > 0 ? captured.join(' ') : null;
}

// ===== LEVENSHTEIN (simple) =====
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
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