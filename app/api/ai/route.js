import { NextResponse } from 'next/server';
import { parseIntent, getContext, setContext, mergeWithContext, clearContext } from '@/app/lib/ai/intent';
import { getRanking, getStatistics, findPlayerByName, getRecommendation, clearRankingCache } from '@/app/lib/ai/ranking';
import { formatResponse } from '@/app/lib/ai/utils';
import { CITY_GROUPS } from '@/app/lib/ai/config';

// ===== GET CITY ALIASES =====
function getCityAliases(city) {
  if (CITY_GROUPS[city]) return CITY_GROUPS[city];
  return [city.toLowerCase()];
}

// ===== GET MATCH SCORE =====
async function getMatchScore(entities) {
  const { name1, name2, name } = entities;
  if (name1 && name2) {
    const p1 = findPlayerByName(name1);
    const p2 = findPlayerByName(name2);
    if (!p1 || !p2) return { _custom_message: 'Salah satu pemain tidak ditemukan.' };
    // TODO: implement match score query
    return { _custom_message: `Pertandingan ${p1.nama} vs ${p2.nama} belum diimplementasikan.` };
  }
  if (name) {
    // get last match for player
    const p = findPlayerByName(name);
    if (!p) return { _custom_message: `Pemain "${name}" tidak ditemukan.` };
    // TODO: implement last match query
    return { _custom_message: `Riwayat ${p.nama} belum diimplementasikan.` };
  }
  return { _custom_message: 'Sebutkan nama pemainnya.' };
}

// ===== EXECUTE QUERY =====
async function executeQuery(parsed) {
  const { intent, entities } = parsed;

  const cityAliases = (city) => {
    if (CITY_GROUPS[city]) return CITY_GROUPS[city];
    return [city.toLowerCase()];
  };

  switch (intent) {
    case 'get_top_rank':
    case 'get_top_n':
      return getRanking({}, entities.limit || 5);
    case 'get_by_tier':
      return getRanking({ tier: entities.tier });
    case 'get_by_city':
      return getRanking({ kota_aliases: cityAliases(entities.city) });
    case 'get_by_tier_and_city':
      return getRanking({ tier: entities.tier, kota_aliases: cityAliases(entities.city) });
    case 'get_top_n_by_tier_and_city':
      return getRanking({ tier: entities.tier, kota_aliases: cityAliases(entities.city) }, entities.limit);
    case 'get_top_n_by_tier':
      return getRanking({ tier: entities.tier }, entities.limit);
    case 'get_top_n_by_city':
      return getRanking({ kota_aliases: cityAliases(entities.city) }, entities.limit);
    case 'get_statistics':
    case 'get_distribution':
      return getStatistics();
    case 'get_player_profile': {
      const p = findPlayerByName(entities.name);
      if (!p) return { _custom_message: `Pemain "${entities.name}" tidak ditemukan.` };
      return [p];
    }
    case 'get_recommendation': {
      const result = await getRecommendation(entities.name);
      return result.data || [];
    }
    case 'compare_players': {
      const { name1, name2 } = entities;
      const p1 = findPlayerByName(name1);
      const p2 = findPlayerByName(name2);
      if (!p1 || !p2) {
        return { _custom_message: 'Salah satu pemain tidak ditemukan.' };
      }
      return { data: [p1, p2], extra: { type: 'comparison' } };
    }
    case 'get_last_match':
    case 'get_match_score':
      return getMatchScore(entities);
    default:
      return [];
  }
}

// ===== POST HANDLER =====
export async function POST(request) {
  try {
    const body = await request.json();
    const userInput = body.message?.trim();

    if (!userInput) {
      return NextResponse.json(
        { success: false, message: 'Pesan kosong.', data: [], type: 'error' },
        { status: 400 }
      );
    }

    // Check for refresh command
    if (/refresh|segarkan|update data|data terbaru|reload/i.test(userInput)) {
      clearRankingCache();
      return NextResponse.json({
        success: true,
        message: 'Data cache telah dibersihkan. Data terbaru akan diambil pada pertanyaan berikutnya.',
        data: [],
        type: 'refresh',
      });
    }

    // Parse intent
    let parsed = parseIntent(userInput);
    if (!parsed.intent) {
      return NextResponse.json({
        success: true,
        message: 'Maaf, saya tidak memahami pertanyaan Anda.',
        data: [],
        type: 'unknown',
      });
    }

    // Merge with context
    const merged = mergeWithContext(userInput, parsed.entities, parsed.intent);
    parsed.intent = merged.intent;
    parsed.entities = merged.entities;
    if (merged.usedContext) {
      parsed.confidence = Math.min((parsed.confidence || 0) + 0.2, 1.0);
    }

    // Set context
    setContext(parsed.intent, parsed.entities);

    // Execute query
    let result = await executeQuery(parsed);

    // Handle _custom_message
    if (result && result._custom_message) {
      return NextResponse.json({
        success: true,
        message: result._custom_message,
        data: [],
        type: parsed.intent,
      });
    }

    // Handle comparison with extra
    if (result && result.extra && result.extra.type === 'comparison') {
      return NextResponse.json({
        success: true,
        message: `Perbandingan ${result.data[0]?.nama || 'player1'} vs ${result.data[1]?.nama || 'player2'}`,
        data: result.data,
        type: 'compare_players',
        extra: { winner: 'Belum ditentukan' },
      });
    }

    // Format response
    const response = formatResponse(parsed, result, parsed.intent);
    return NextResponse.json(response);
  } catch (err) {
    console.error('AI API error:', err);
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan: ' + err.message, data: [], type: 'error' },
      { status: 500 }
    );
  }
}