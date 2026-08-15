import { NextResponse } from 'next/server';
import { parseIntent, mergeWithContext, setContext } from '@/app/lib/ai/intent';
import {
  getRanking, getStatistics, getRecommendation,
  comparePlayers, getLastMatch, getMatchScore,
  findPlayerByName, clearRankingCache
} from '@/app/lib/ai/ranking';
import { formatResponse } from '@/app/lib/ai/utils';
import { CITY_GROUPS } from '@/app/lib/ai/config';

function cityAliases(city) {
  return CITY_GROUPS[city] || [city.toLowerCase()];
}

async function executeQuery(parsed) {
  const { intent, entities } = parsed;
  const e = entities;

  switch (intent) {
    case 'get_top_rank':
      return getRanking({}, 1);
    case 'get_top_n':
      return getRanking({}, e.limit || 5);
    case 'get_by_tier':
      return getRanking({ tier: e.tier });
    case 'get_by_city':
      return getRanking({ kota_aliases: cityAliases(e.city) });
    case 'get_by_tier_and_city':
      return getRanking({ tier: e.tier, kota_aliases: cityAliases(e.city) });
    case 'get_top_n_by_tier_and_city':
      return getRanking({ tier: e.tier, kota_aliases: cityAliases(e.city) }, e.limit);
    case 'get_top_n_by_tier':
      return getRanking({ tier: e.tier }, e.limit);
    case 'get_top_n_by_city':
      return getRanking({ kota_aliases: cityAliases(e.city) }, e.limit);
    case 'get_statistics':
    case 'get_distribution':
      return getStatistics();

    // === FIX: pass null, bukan undefined ===
    case 'get_recommendation':
      return getRecommendation(e.name || null);

    // === FIX: pakai fungsi dari ranking.js (lengkap dengan winner logic) ===
    case 'compare_players':
      return comparePlayers(e.name1, e.name2);

    // === FIX: riwayat tanding ===
    case 'get_last_match':
      return getLastMatch(e.name);
    case 'get_match_score':
      return getMatchScore(e.name1 || e.name, e.name2);

    case 'get_player_profile': {
      const p = findPlayerByName(e.name);
      if (!p) return { _custom_message: `Pemain "${e.name}" tidak ditemukan.` };
      return [p];
    }
    default:
      return [];
  }
}

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

    // Refresh command
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
    setContext(parsed.intent, parsed.entities);

    // Execute query
    const result = await executeQuery(parsed);

    // Format (semua jenis response ditangani formatResponse — tidak perlu handling manual di sini)
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