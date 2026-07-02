import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const tierOrder = ['rintis', 'isen', 'menteng', 'amok', 'tuah', 'maung', 'sura'];
const tierValue = {
  rintis: 1,
  isen: 2,
  menteng: 3,
  amok: 4,
  tuah: 5,
  maung: 6,
  sura: 7,
};

async function getUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId;
  } catch {
    return null;
  }
}

async function updateRank(userId, isWin, opponentTier, opponentBintang) {
  const { data: rank, error } = await supabaseAdmin
    .from('rank')
    .select('tier, bintang, streak')
    .eq('user_id', userId)
    .single();
  if (error || !rank) return;

  let newTier = rank.tier;
  let newBintang = rank.bintang;
  let newStreak = isWin ? rank.streak + 1 : 0;

  if (isWin) {
    const userVal = tierValue[newTier];
    const oppVal = tierValue[opponentTier];
    if (oppVal > userVal) newBintang += 2;
    else if (oppVal === userVal) newBintang += 1;
    if (newBintang >= 5) {
      const idx = tierOrder.indexOf(newTier);
      if (idx < tierOrder.length - 1) {
        newTier = tierOrder[idx + 1];
        newBintang -= 5;
      } else {
        newBintang = 0;
      }
    }
  } else {
    newBintang -= 1;
    if (newBintang < 0) {
      const idx = tierOrder.indexOf(newTier);
      if (idx > 0) {
        newTier = tierOrder[idx - 1];
        newBintang = 4;
      } else {
        newBintang = 0;
      }
    }
  }

  await supabaseAdmin
    .from('rank')
    .update({ tier: newTier, bintang: newBintang, streak: newStreak })
    .eq('user_id', userId);
}

async function checkExpiredMatches() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);
  const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

  const { data: matches } = await supabaseAdmin
    .from('pertandingan')
    .select('id, challenger_id, challenged_id, tanggal')
    .eq('status', 'accepted')
    .lte('tanggal', twoDaysAgoStr);
  if (!matches) return;

  for (const match of matches) {
    const { data: scores } = await supabaseAdmin
      .from('skor')
      .select('input_by, confirmed')
      .eq('match_id', match.id);
    const challengerConfirmed = scores?.some(s => s.input_by === match.challenger_id && s.confirmed);
    const challengedConfirmed = scores?.some(s => s.input_by === match.challenged_id && s.confirmed);

    if (!challengerConfirmed && !challengedConfirmed) {
      await supabaseAdmin.from('pertandingan').update({ status: 'expired' }).eq('id', match.id);
    } else if (challengerConfirmed && !challengedConfirmed) {
      const { data: challengedRank } = await supabaseAdmin
        .from('rank')
        .select('tier, bintang')
        .eq('user_id', match.challenged_id)
        .single();
      await updateRank(match.challenger_id, true, challengedRank.tier, challengedRank.bintang);
      const { data: winnerRank } = await supabaseAdmin
        .from('rank')
        .select('tier, bintang')
        .eq('user_id', match.challenger_id)
        .single();
      await updateRank(match.challenged_id, false, winnerRank.tier, winnerRank.bintang);
      await supabaseAdmin.from('pertandingan').update({ status: 'done' }).eq('id', match.id);
    } else if (!challengerConfirmed && challengedConfirmed) {
      const { data: challengerRank } = await supabaseAdmin
        .from('rank')
        .select('tier, bintang')
        .eq('user_id', match.challenger_id)
        .single();
      await updateRank(match.challenged_id, true, challengerRank.tier, challengerRank.bintang);
      const { data: winnerRank } = await supabaseAdmin
        .from('rank')
        .select('tier, bintang')
        .eq('user_id', match.challenged_id)
        .single();
      await updateRank(match.challenger_id, false, winnerRank.tier, winnerRank.bintang);
      await supabaseAdmin.from('pertandingan').update({ status: 'done' }).eq('id', match.id);
    }
  }
}

export async function GET(req) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  await checkExpiredMatches();

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get('tab');

  if (tab === 'ajakan') {
    const { data: matches, error } = await supabaseAdmin
      .from('pertandingan')
      .select('*')
      .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!matches.length) return Response.json({ data: [] });

    const opponentIds = matches
      .map(m => m.challenger_id === userId ? m.challenged_id : (m.challenger_id || null))
      .filter(id => id !== null);
    
    let users = [], ranks = [];
    if (opponentIds.length > 0) {
      const { data: u } = await supabaseAdmin.from('users').select('id, nama, foto_url, no_wa').in('id', opponentIds);
      users = u || [];
      const { data: r } = await supabaseAdmin.from('rank').select('user_id, tier, bintang').in('user_id', opponentIds);
      ranks = r || [];
    }
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const rankMap = Object.fromEntries(ranks.map(r => [r.user_id, r]));

    const data = matches.map(m => {
      const isChallenged = m.challenged_id === userId;
      if (m.challenger_id === null) {
        return {
          id: m.id,
          tanggal: m.tanggal,
          waktu: m.waktu,
          lokasi: m.lokasi,
          isGuest: true,
          opponent: {
            id: null,
            nama: m.guest_name || 'Guest',
            foto_url: null,
            no_wa: m.guest_phone || '',
            tier: 'Guest',
            bintang: 0,
          },
          userRole: 'challenged',
        };
      }

      const opponentId = m.challenger_id === userId ? m.challenged_id : m.challenger_id;
      return {
        id: m.id,
        tanggal: m.tanggal,
        waktu: m.waktu,
        lokasi: m.lokasi,
        isGuest: false,
        opponent: {
          id: opponentId,
          nama: userMap[opponentId]?.nama || 'Unknown',
          foto_url: userMap[opponentId]?.foto_url,
          no_wa: userMap[opponentId]?.no_wa,
          tier: rankMap[opponentId]?.tier || 'rintis',
          bintang: rankMap[opponentId]?.bintang || 0,
        },
        userRole: isChallenged ? 'challenged' : 'challenger',
      };
    });
    return Response.json({ data });
  }

  if (tab === 'terjadwal') {
    const { data: matches, error } = await supabaseAdmin
      .from('pertandingan')
      .select('*')
      .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
      .eq('status', 'accepted')
      .order('tanggal', { ascending: true });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!matches.length) return Response.json({ data: [] });

    const opponentIds = matches
      .map(m => m.challenger_id === userId ? m.challenged_id : (m.challenger_id || null))
      .filter(id => id !== null);
    let users = [], ranks = [];
    if (opponentIds.length > 0) {
      const { data: u } = await supabaseAdmin.from('users').select('id, nama, foto_url').in('id', opponentIds);
      users = u || [];
      const { data: r } = await supabaseAdmin.from('rank').select('user_id, tier, bintang').in('user_id', opponentIds);
      ranks = r || [];
    }
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const rankMap = Object.fromEntries(ranks.map(r => [r.user_id, r]));

    const data = matches.map(m => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const matchDate = new Date(m.tanggal);
      const isPast = matchDate < today;
      
      if (m.challenger_id === null) {
        return {
          id: m.id,
          tanggal: m.tanggal,
          waktu: m.waktu,
          lokasi: m.lokasi,
          isGuest: true,
          opponent: {
            id: null,
            nama: m.guest_name || 'Guest',
            foto_url: null,
            tier: 'Guest',
            bintang: 0,
          },
          reminder: isPast,
        };
      }

      const opponentId = m.challenger_id === userId ? m.challenged_id : m.challenger_id;
      return {
        id: m.id,
        tanggal: m.tanggal,
        waktu: m.waktu,
        lokasi: m.lokasi,
        isGuest: false,
        opponent: {
          id: opponentId,
          nama: userMap[opponentId]?.nama || 'Unknown',
          foto_url: userMap[opponentId]?.foto_url,
          tier: rankMap[opponentId]?.tier || 'rintis',
          bintang: rankMap[opponentId]?.bintang || 0,
        },
        reminder: isPast,
      };
    });
    return Response.json({ data });
  }

  if (tab === 'riwayat') {
    const { data: matches, error } = await supabaseAdmin
      .from('pertandingan')
      .select('*')
      .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
      .in('status', ['done', 'expired', 'rejected'])
      .order('tanggal', { ascending: false });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!matches.length) return Response.json({ data: [] });

    const matchIds = matches.map(m => m.id);
    const { data: allScores } = await supabaseAdmin
      .from('skor')
      .select('match_id, input_by, skor_sendiri, skor_lawan, confirmed')
      .in('match_id', matchIds);
    const scoreMap = new Map();
    allScores?.forEach(s => {
      if (!scoreMap.has(s.match_id)) scoreMap.set(s.match_id, []);
      scoreMap.get(s.match_id).push(s);
    });

    const opponentIds = matches
      .map(m => m.challenger_id === userId ? m.challenged_id : (m.challenger_id || null))
      .filter(id => id !== null);
    let users = [], ranks = [];
    if (opponentIds.length > 0) {
      const { data: u } = await supabaseAdmin.from('users').select('id, nama, foto_url').in('id', opponentIds);
      users = u || [];
      const { data: r } = await supabaseAdmin.from('rank').select('user_id, tier, bintang').in('user_id', opponentIds);
      ranks = r || [];
    }
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const rankMap = Object.fromEntries(ranks.map(r => [r.user_id, r]));

    const data = matches.map(m => {
      const scores = scoreMap.get(m.id) || [];
      const userScores = scores.filter(s => s.input_by === userId);
      const opponentScores = scores.filter(s => s.input_by !== userId);
      let hasil = '';
      let skorTeks = '-';
      let statusText = '';

      if (m.status === 'rejected') {
        statusText = 'Ditolak';
      } else if (m.status === 'expired') {
        statusText = 'Kadaluwarsa';
      } else if (m.status === 'done') {
        if (userScores.length > 0 && opponentScores.length > 0) {
          const userScore = userScores[0];
          const oppScore = opponentScores[0];
          const isSync =
            userScore.skor_sendiri === oppScore.skor_lawan &&
            userScore.skor_lawan === oppScore.skor_sendiri;
          if (isSync && userScore.confirmed && oppScore.confirmed) {
            skorTeks = `${userScore.skor_sendiri}-${userScore.skor_lawan}`;
            const isWin = userScore.skor_sendiri > userScore.skor_lawan;
            hasil = isWin
              ? 'Menang'
              : userScore.skor_sendiri < userScore.skor_lawan
              ? 'Kalah'
              : 'Draw';
          } else {
            hasil = 'Invalid';
          }
        } else {
          hasil = 'Tidak selesai';
        }
      }

      let opponentName = 'Unknown';
      let opponentTier = '';
      let opponentFoto = null;
      let isGuest = false;

      if (m.challenger_id === null) {
        isGuest = true;
        opponentName = m.guest_name || 'Guest';
        opponentTier = 'Guest';
      } else {
        const oppId = m.challenger_id === userId ? m.challenged_id : m.challenger_id;
        const u = userMap[oppId];
        opponentName = u?.nama || 'Unknown';
        opponentFoto = u?.foto_url || null;
        const rank = rankMap[oppId];
        opponentTier = rank ? `${rank.tier} ${'★'.repeat(rank.bintang)}` : '';
      }

      return {
        id: m.id,
        tanggal: m.tanggal,
        lokasi: m.lokasi,
        opponent: {
          nama: opponentName,
          foto_url: opponentFoto,
          tier: opponentTier,
          isGuest,
        },
        skor: skorTeks,
        hasil: hasil || statusText,
        isGuest,
      };
    });
    return Response.json({ data });
  }

  return Response.json({ data: [] });
}

export async function POST(req) {
  const userId = await getUserId();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, ...body } = await req.json();

  if (action === 'terima') {
    const { matchId } = body;
    const { data: match, error: matchError } = await supabaseAdmin
      .from('pertandingan')
      .select('challenger_id, challenged_id, guest_name, guest_phone, tanggal, waktu, lokasi')
      .eq('id', matchId)
      .single();
    if (matchError) return Response.json({ error: 'Pertandingan tidak ditemukan' }, { status: 404 });

    let challengerNama, challengerNoWa;
    if (match.challenger_id === null) {
      challengerNama = match.guest_name || 'Guest';
      challengerNoWa = match.guest_phone || '';
    } else {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('nama, no_wa')
        .eq('id', match.challenger_id)
        .single();
      challengerNama = user?.nama || 'Unknown';
      challengerNoWa = user?.no_wa || '';
    }

    const { error: updateError } = await supabaseAdmin
      .from('pertandingan')
      .update({ status: 'accepted' })
      .eq('id', matchId)
      .eq('challenged_id', userId);
    if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

    const message = `Hei ${challengerNama}! Gue terima challengemu. Kita main ${match.tanggal} ${match.waktu} di ${match.lokasi}. Konfirmasi jam-nya ya?`;
    const waLink = `https://wa.me/${challengerNoWa}?text=${encodeURIComponent(message)}`;
    return Response.json({ success: true, waLink });
  }

  if (action === 'tolak') {
    const { matchId } = body;
    const { data: match, error: matchError } = await supabaseAdmin
      .from('pertandingan')
      .select('challenger_id, challenged_id, guest_name, guest_phone')
      .eq('id', matchId)
      .single();
    if (matchError) return Response.json({ error: 'Pertandingan tidak ditemukan' }, { status: 404 });

    let challengerNama, challengerNoWa;
    if (match.challenger_id === null) {
      challengerNama = match.guest_name || 'Guest';
      challengerNoWa = match.guest_phone || '';
    } else {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('nama, no_wa')
        .eq('id', match.challenger_id)
        .single();
      challengerNama = user?.nama || 'Unknown';
      challengerNoWa = user?.no_wa || '';
    }

    const { error: updateError } = await supabaseAdmin
      .from('pertandingan')
      .update({ status: 'rejected' })
      .eq('id', matchId)
      .eq('challenged_id', userId);
    if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

    const message = `Hei ${challengerNama}! Maaf gue belum bisa terima challengemu.`;
    const waLink = `https://wa.me/${challengerNoWa}?text=${encodeURIComponent(message)}`;
    return Response.json({ success: true, waLink });
  }

  if (action === 'skor') {
    const { matchId, skorSendiri, skorLawan } = body;
    
    const { data: match, error: matchError } = await supabaseAdmin
      .from('pertandingan')
      .select('challenger_id, challenged_id, tanggal')
      .eq('id', matchId)
      .single();
    if (matchError) return Response.json({ error: 'Pertandingan tidak ditemukan' }, { status: 404 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const matchDate = new Date(match.tanggal);
    matchDate.setHours(0, 0, 0, 0);
    const twoDaysLater = new Date(matchDate);
    twoDaysLater.setDate(matchDate.getDate() + 2);
    if (today > twoDaysLater) {
      return Response.json({ error: 'Waktu input skor sudah habis (H+2).' }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from('skor')
      .select('id, input_by, skor_sendiri, skor_lawan')
      .eq('match_id', matchId)
      .eq('confirmed', false);
    if (existing?.some(s => s.input_by === userId)) {
      return Response.json({ error: 'Anda sudah input skor untuk pertandingan ini' }, { status: 400 });
    }

    const { data: newSkor, error: insertError } = await supabaseAdmin
      .from('skor')
      .insert({
        match_id: matchId,
        input_by: userId,
        skor_sendiri: skorSendiri,
        skor_lawan: skorLawan,
        confirmed: false,
      })
      .select()
      .single();
    if (insertError) return Response.json({ error: 'Gagal menyimpan skor' }, { status: 500 });

    const opponentSkor = existing?.find(s => s.input_by !== userId);
    if (opponentSkor) {
      const { data: opponentData } = await supabaseAdmin
        .from('skor')
        .select('input_by, skor_sendiri, skor_lawan')
        .eq('id', opponentSkor.id)
        .single();
      
      const isSync = (skorSendiri === opponentData.skor_lawan) && (skorLawan === opponentData.skor_sendiri);
      if (isSync) {
        const userScore = skorSendiri;
        const opponentScore = opponentData.skor_sendiri;
        const isUserWin = userScore > opponentScore;
        const winnerId = isUserWin ? userId : opponentData.input_by;
        const loserId = isUserWin ? opponentData.input_by : userId;
        const { data: loserRank } = await supabaseAdmin.from('rank').select('tier, bintang').eq('user_id', loserId).single();
        const { data: winnerRank } = await supabaseAdmin.from('rank').select('tier, bintang').eq('user_id', winnerId).single();
        await updateRank(winnerId, true, loserRank.tier, loserRank.bintang);
        await updateRank(loserId, false, winnerRank.tier, winnerRank.bintang);
        await supabaseAdmin.from('skor').update({ confirmed: true }).in('id', [newSkor.id, opponentSkor.id]);
        await supabaseAdmin.from('pertandingan').update({ status: 'done' }).eq('id', matchId);
        return Response.json({ success: true, message: 'Skor valid! Pertandingan selesai, rank diperbarui.' });
      } else {
        await supabaseAdmin.from('pertandingan').update({ status: 'expired' }).eq('id', matchId);
        return Response.json({ error: 'Skor tidak sinkron dengan lawan. Pertandingan dibatalkan.' }, { status: 400 });
      }
    }
    return Response.json({ success: true, message: 'Skor disimpan, menunggu input dari lawan.' });
  }

  if (action === 'check_expired') {
    await checkExpiredMatches();
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Aksi tidak valid' }, { status: 400 });
}