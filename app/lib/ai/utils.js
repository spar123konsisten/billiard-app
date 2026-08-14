export function confidenceLabel(score) {
  if (score >= 0.8) return '';
  if (score >= 0.6) return '🤔 ';
  if (score >= 0.4) return 'Saya kurang yakin, tapi ini tebakan saya. ';
  return 'Saya tidak terlalu paham, tapi coba ini: ';
}

export function formatResponse(parsed, data, intent) {
  const { entities = {}, confidence = 1.0 } = parsed;
  const tier = entities.tier ? entities.tier.toUpperCase() : '';
  const city = entities.city || '';
  const limit = entities.limit || (Array.isArray(data) ? data.length : 0);

  // Statistics
  if (intent === 'get_statistics' || intent === 'get_distribution') {
    const s = data;
    if (!s || typeof s !== 'object' || !s.total) {
      return { success: true, message: 'Tidak ada data statistik.', data: [], type: 'stats' };
    }
    let msg = `<strong>Statistik Pemain</strong><br><br>`;
    msg += `• Total pemain: <strong>${s.total}</strong><br>`;
    msg += `• Rata-rata bintang: <strong>${s.avg_stars}</strong><br>`;
    msg += `• Rata-rata streak: <strong>${s.avg_streak}</strong><br><br>`;
    msg += `<strong>Distribusi per tier:</strong><br>`;
    for (const [t, c] of Object.entries(s.by_tier)) {
      msg += `&nbsp;&nbsp;• ${t}: ${c}<br>`;
    }
    msg += `<br><strong>Distribusi per kota:</strong><br>`;
    for (const [c, n] of Object.entries(s.by_city)) {
      if (n > 0) msg += `&nbsp;&nbsp;• ${c}: ${n}<br>`;
    }
    return { success: true, message: confidenceLabel(confidence) + msg, data: [], type: 'stats' };
  }

  // Empty data
  if (!data || (Array.isArray(data) && data.length === 0)) {
    let debug = '';
    if (tier || city) {
      debug = ` (Filter: ${tier ? `tier=${tier}` : ''}${tier && city ? ', ' : ''}${city ? `kota=${city}` : ''})`;
    }
    return { success: true, message: confidenceLabel(confidence) + `Tidak ada data yang sesuai dengan pencarian Anda.${debug}`, data: [], type: 'empty' };
  }

  // Build message
  let message = 'Hasil pencarian:';
  switch (intent) {
    case 'get_top_rank': message = 'Peringkat 1 saat ini:'; break;
    case 'get_top_n': message = `Top ${limit} pemain saat ini:`; break;
    case 'get_by_tier': message = `Pemain tier ${tier}:`; break;
    case 'get_by_city': message = `Pemain di ${city}:`; break;
    case 'get_by_tier_and_city': message = `Pemain tier ${tier} di ${city}:`; break;
    case 'get_top_n_by_tier_and_city': message = `Top ${limit} pemain tier ${tier} di ${city}:`; break;
    case 'get_top_n_by_tier': message = `Top ${limit} pemain tier ${tier}:`; break;
    case 'get_top_n_by_city': message = `Top ${limit} pemain di ${city}:`; break;
    case 'get_player_profile': message = 'Profil pemain:'; break;
    case 'get_recommendation': message = 'Rekomendasi lawan tanding:'; break;
    case 'compare_players': message = 'Perbandingan pemain:'; break;
  }

  return {
    success: true,
    message: confidenceLabel(confidence) + message,
    data: Array.isArray(data) ? data : [],
    type: intent,
  };
}