// ===== TIER ORDER =====
export const TIER_ORDER = {
  rintis: 1,
  isen: 2,
  menteng: 3,
  amok: 4,
  tuah: 5,
  maung: 6,
  sura: 7,
};

export const TIER_NAMES = Object.keys(TIER_ORDER);

// ===== TIER SYNONYMS =====
export const TIER_SYNONYMS = {
  rintis: ['rintis', 'pemula', 'newbie', 'beginner', 'bronze', 'dasar'],
  isen: ['isen', 'silver', 'menengah'],
  menteng: ['menteng', 'gold', 'emas', 'mid'],
  amok: ['amok', 'platinum'],
  tuah: ['tuah', 'diamond', 'berlian'],
  maung: ['maung', 'master', 'pro'],
  sura: ['sura', 'legend', 'mythic', 'dewa', 'tertinggi', 'juara', 'top'],
};

// ===== CITY GROUPS =====
export const CITY_GROUPS = {
  Jakarta: ['jakarta', 'jkt', 'jaksel', 'jakut', 'jaktim', 'jakbar', 'jakarta selatan', 'jakarta timur', 'jakarta utara', 'jakarta barat', 'jakarta pusat'],
  Bekasi: ['bekasi'],
  Bandung: ['bandung', 'bdg'],
  Surabaya: ['surabaya', 'sby'],
  Medan: ['medan'],
  Bali: ['bali', 'denpasar'],
  Tangerang: ['tangerang', 'tangsel'],
  Jogja: ['jogja', 'yogyakarta', 'jogjakarta', 'yogya'],
  Depok: ['depok'],
  Bogor: ['bogor'],
  Semarang: ['semarang'],
  Solo: ['solo', 'surakarta'],
  Malang: ['malang'],
  Makassar: ['makassar', 'ujung pandang'],
  Palembang: ['palembang'],
  Pontianak: ['pontianak'],
  Pekanbaru: ['pekanbaru'],
  Batam: ['batam'],
  Balikpapan: ['balikpapan', 'bpp'],
  Cirebon: ['cirebon'],
};

// ===== FILLER WORDS (diabaikan saat parsing) =====
export const FILLER_WORDS = [
  'min', 'admin', 'kak', 'kakak', 'bang', 'pak', 'bu', 'ibu', 'mas', 'mbak', 'gan', 'bro', 'sis', 'bos',
  'tolong', 'coba', 'dong', 'deh', 'sih', 'nih', 'tuh', 'yah', 'ya', 'kalo', 'kalau', 'misal', 'misalnya', 'contoh',
  'gimana', 'bagaimana', 'boleh', 'bisa', 'mau', 'aku', 'saya', 'kamu', 'anda', 'please', 'tanya', 'liat', 'lihat',
  'cek', 'search', 'cari', 'tau', 'tahu', 'gak', 'ga', 'nggak', 'tidak', 'bukan', 'apa', 'apakah', 'siapa', 'siapakah',
  'yang', 'yg', 'di', 'dari', 'ke', 'pada', 'buat', 'untuk', 'aja', 'saja', 'doang', 'ada', 'kah', 'pemain', 'player',
  'user', 'orang', 'tier', 'tingkat', 'level', 'kota', 'daerah', 'wilayah', 'nya',
  'billiard', 'biliar', 'pool', 'bola', 'olahraga', 'sport',
];

export const QUICK_REPLIES = [
  'siapa peringkat 1?',
  'top 5 pemain',
  'siapa tier rintis?',
  'refresh data',
];