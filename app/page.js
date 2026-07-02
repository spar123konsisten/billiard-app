import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import LiveChat from './components/LiveChat';

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'baru saja';
  if (diffMin < 60) return `${diffMin} mnt`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} jam`;
  return `${Math.floor(diffMin / 1440)} hari`;
}

export default async function Home() {
  // ===== 1. LEADERBOARD (5 TERATAS) =====
  let leaderboard = [];
  try {
    const { data: rankData } = await supabaseAdmin
      .from('rank')
      .select('user_id, tier, bintang, poin')
      .order('poin', { ascending: false })
      .limit(5);

    if (rankData && rankData.length > 0) {
      const userIds = rankData.map((item) => item.user_id);
      const { data: usersData } = await supabaseAdmin
        .from('users')
        .select('id, nama, kota, foto_url')
        .in('id', userIds);

      const userMap = {};
      usersData?.forEach((u) => { userMap[u.id] = u; });

      leaderboard = rankData.map((item) => {
        const user = userMap[item.user_id];
        return {
          seed: item.user_id,
          nama: user?.nama || 'Unknown',
          kota: user?.kota || '-',
          rank: `${item.tier} ${'★'.repeat(item.bintang || 0)}`,
          poin: item.poin || 0,
        };
      });
    }
  } catch (err) {
    console.error('Leaderboard error:', err);
  }

  // ===== 2. FEED (10 AKTIVITAS TERBARU) dengan LAYOUT BARU =====
  let feed = [];
  try {
    const { data: skorData, error: skorError } = await supabaseAdmin
      .from('skor')
      .select('id, match_id, input_by, skor_sendiri, skor_lawan, created_at')
      .eq('confirmed', true)
      .order('created_at', { ascending: false });

    if (skorError) {
      console.error('Supabase error on skor:', skorError);
    } else if (skorData && skorData.length > 0) {
      // Filter hanya pemenang (skor_sendiri > skor_lawan)
      const winners = skorData.filter(item => item.skor_sendiri > item.skor_lawan);
      const topWinners = winners.slice(0, 10);

      if (topWinners.length > 0) {
        const matchIds = topWinners.map((item) => item.match_id);
        const { data: matchData } = await supabaseAdmin
          .from('pertandingan')
          .select('id, challenger_id, challenged_id')
          .in('id', matchIds);

        const matchMap = {};
        matchData?.forEach((m) => { matchMap[m.id] = m; });

        // Kumpulkan semua user_id yang terlibat (pemenang + lawan)
        const userIds = new Set();
        for (const item of topWinners) {
          const match = matchMap[item.match_id];
          if (!match) continue;
          userIds.add(item.input_by);
          const lawanId = match.challenger_id === item.input_by ? match.challenged_id : match.challenger_id;
          userIds.add(lawanId);
        }

        // Ambil data user (nama, foto_url) dan juga rank
        const { data: usersData } = await supabaseAdmin
          .from('users')
          .select('id, nama, foto_url')
          .in('id', [...userIds]);

        const userMap = {};
        usersData?.forEach((u) => { userMap[u.id] = u; });

        // Ambil rank untuk semua user yang terlibat
        const { data: rankData } = await supabaseAdmin
          .from('rank')
          .select('user_id, tier, bintang')
          .in('user_id', [...userIds]);

        const rankMap = {};
        rankData?.forEach((r) => {
          rankMap[r.user_id] = `${r.tier} ${'★'.repeat(r.bintang || 0)}`;
        });

        for (const item of topWinners) {
          const match = matchMap[item.match_id];
          if (!match) continue;
          const pemenang = userMap[item.input_by];
          if (!pemenang) continue;
          const lawanId = match.challenger_id === item.input_by ? match.challenged_id : match.challenger_id;
          const lawan = userMap[lawanId];
          if (!lawan) continue;

          feed.push({
            pemenangId: item.input_by,
            pemenangNama: pemenang.nama,
            pemenangFoto: pemenang.foto_url || null,
            pemenangRank: rankMap[item.input_by] || '-',
            skorSendiri: item.skor_sendiri,
            skorLawan: item.skor_lawan,
            lawanId,
            lawanNama: lawan.nama,
            lawanFoto: lawan.foto_url || null,
            lawanRank: rankMap[lawanId] || '-',
            waktu: formatRelativeTime(item.created_at),
          });
        }
      }
    }
  } catch (err) {
    console.error('Feed error:', err?.message || err);
  }

  // ===== 3. CHAT DUMMY =====
  const chatMessages = [
    { id: 1, user: 'Raka', message: 'Ada yang mau main sore ini?', waktu: '5 mnt' },
    { id: 2, user: 'Doni', message: 'Saya mau! Golden Billiard jam 4?', waktu: '3 mnt' },
    { id: 3, user: 'Sari', message: 'Mau ikut dong, tapi di Break Point aja', waktu: '1 mnt' },
  ];
  const onlineCount = 3;

  return (
    <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      {/* Live bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#1D9E75',
            display: 'inline-block',
          }}
        ></span>
        <span
          style={{
            fontSize: '11px',
            color: '#888',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}
        >
          banyak player aktif mencari sparring
        </span>
      </div>

      {/* Hero */}
      <h1
        style={{
          fontSize: '28px',
          fontWeight: '500',
          lineHeight: '1.2',
          margin: '0 0 10px',
        }}
      >
        Tantang siapapun.
        <br />
        <span style={{ borderBottom: '2px solid black' }}>Buktikan levelmu.</span>
      </h1>
      <p
        style={{
          fontSize: '14px',
          color: '#666',
          marginBottom: '20px',
          lineHeight: '1.6',
        }}
      >
        Platform sparring billiard pertama di Indonesia. Cari lawan, main, naik rank.
      </p>

      {/* CTA */}
      <Link href="/register" style={{ textDecoration: 'none' }}>
        <button
          style={{
            width: '100%',
            padding: '15px',
            background: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '15px',
            fontWeight: '500',
            display: 'flex',
            justifyContent: 'space-between',
            cursor: 'pointer',
            marginBottom: '32px',
          }}
        >
          <span>Daftar & cari lawan</span>
          <span>→</span>
        </button>
      </Link>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            border: '0.5px solid #e5e5e5',
            borderRadius: '4px',
            padding: '14px',
          }}
        >
          <span
            style={{
              fontSize: '28px',
              fontWeight: '500',
              display: 'block',
              lineHeight: '1',
              marginBottom: '4px',
            }}
          >
            47
          </span>
          <span style={{ fontSize: '11px', color: '#888' }}>
            Player cari lawan sekarang
          </span>
        </div>
        <div
          style={{
            border: '0.5px solid #e5e5e5',
            borderRadius: '4px',
            padding: '14px',
          }}
        >
          <span
            style={{
              fontSize: '28px',
              fontWeight: '500',
              display: 'block',
              lineHeight: '1',
              marginBottom: '4px',
            }}
          >
            1.240
          </span>
          <span style={{ fontSize: '11px', color: '#888' }}>
            Match dimainkan
          </span>
        </div>
      </div>

      <hr
        style={{
          border: 'none',
          borderTop: '0.5px solid #e5e5e5',
          marginBottom: '24px',
        }}
      />

      {/* Leaderboard */}
      <p
        style={{
          fontSize: '10px',
          color: '#aaa',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          marginBottom: '12px',
        }}
      >
        Top player minggu ini
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '24px 1fr 90px',
          gap: '8px',
          paddingBottom: '8px',
          borderBottom: '0.5px solid #e5e5e5',
          marginBottom: '4px',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            color: '#aaa',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}
        >
          #
        </span>
        <span
          style={{
            fontSize: '10px',
            color: '#aaa',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}
        >
          Player
        </span>
        <span
          style={{
            fontSize: '10px',
            color: '#aaa',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}
        >
          Rank
        </span>
      </div>

      {leaderboard.map((p, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '24px 1fr 90px',
            gap: '8px',
            alignItems: 'center',
            padding: '10px 0',
            borderBottom:
              i < leaderboard.length - 1 ? '0.5px solid #e5e5e5' : 'none',
            background: i === 0 ? '#f9f9f9' : 'transparent',
          }}
        >
          <span
            style={{
              fontSize: '13px',
              fontWeight: '500',
              color: i === 0 ? '#BA7517' : '#888',
            }}
          >
            {i + 1}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <img
              src={`https://picsum.photos/seed/${p.seed}/30/30`}
              alt={p.nama}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '3px',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
            <div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.nama}
              </div>
              <div style={{ fontSize: '11px', color: '#888' }}>{p.kota}</div>
            </div>
          </div>
          <span
            style={{
              fontSize: '10px',
              border: '0.5px solid #e5e5e5',
              borderRadius: '3px',
              padding: '2px 5px',
              color: '#888',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {p.rank}
          </span>
        </div>
      ))}

      {/* Link ke registrasi */}
      <Link href="/register" style={{ textDecoration: 'none' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '14px',
            border: '0.5px dashed #ccc',
            borderRadius: '4px',
            marginTop: '12px',
            marginBottom: '32px',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '13px', color: '#888' }}>#??? —</span>
          <span style={{ fontSize: '13px', fontWeight: '500' }}>
            Posisi lo di mana? Daftar →
          </span>
        </div>
      </Link>

      <hr
        style={{
          border: 'none',
          borderTop: '0.5px solid #e5e5e5',
          marginBottom: '24px',
        }}
      />

      {/* Live Chat Global */}
      <LiveChat initialMessages={chatMessages} onlineCount={onlineCount} />

      {/* Feed dengan layout baru */}
      <p
        style={{
          fontSize: '10px',
          color: '#aaa',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          marginBottom: '10px',
        }}
      >
        Baru saja terjadi
      </p>

      {feed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#aaa', fontSize: '13px' }}>
          Belum ada aktivitas.
        </div>
      ) : (
        feed.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              gap: '12px',
              padding: '10px 0',
              borderBottom: i < feed.length - 1 ? '0.5px solid #e5e5e5' : 'none',
            }}
          >
            {/* Kiri: foto + tier */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <img
                src={item.pemenangFoto || `https://picsum.photos/seed/${item.pemenangId}/60/60`}
                alt={item.pemenangNama}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '4px',
                  objectFit: 'cover',
                }}
              />
              <span style={{ fontSize: '10px', color: '#888', textAlign: 'center' }}>{item.pemenangRank}</span>
            </div>

            {/* Tengah: nama, vs, skor, waktu */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
              {/* Baris 1: Nama kiri & kanan */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontWeight: '600', fontSize: '14px' }}>{item.pemenangNama}</span>
                <span style={{ fontWeight: '600', fontSize: '14px' }}>{item.lawanNama}</span>
              </div>

              {/* Baris 2: Skor kiri, ·, skor kanan */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: '2px' }}>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#000' }}>{item.skorSendiri}</span>
                <span style={{ fontSize: '14px', color: '#ccc' }}>·</span>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#000' }}>{item.skorLawan}</span>
              </div>

              {/* Baris 3: Waktu */}
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px', textAlign: 'center' }}>
                {item.waktu}
              </div>
            </div>

            {/* Kanan: foto + tier */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <img
                src={item.lawanFoto || `https://picsum.photos/seed/${item.lawanId}/60/60`}
                alt={item.lawanNama}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '4px',
                  objectFit: 'cover',
                }}
              />
              <span style={{ fontSize: '10px', color: '#888', textAlign: 'center' }}>{item.lawanRank}</span>
            </div>
          </div>
        ))
      )}
    </main>
  );
}