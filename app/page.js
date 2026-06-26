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
  // ===== 1. AMBIL LEADERBOARD (5 TERATAS) =====
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

  // ===== 2. AMBIL FEED (10 AKTIVITAS TERBARU) =====
  let feed = [];
  try {
    const { data: skorData } = await supabaseAdmin
      .from('skor')
      .select('id, match_id, input_by, skor_sendiri, skor_lawan, created_at')
      .eq('confirmed', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (skorData && skorData.length > 0) {
      const matchIds = skorData.map((item) => item.match_id);
      const { data: matchData } = await supabaseAdmin
        .from('pertandingan')
        .select('id, challenger_id, challenged_id, lokasi')
        .in('id', matchIds);

      const matchMap = {};
      matchData?.forEach((m) => { matchMap[m.id] = m; });

      const userIds = [];
      for (const item of skorData) {
        const match = matchMap[item.match_id];
        if (!match) continue;
        userIds.push(item.input_by);
        const lawanId = match.challenger_id === item.input_by ? match.challenged_id : match.challenger_id;
        userIds.push(lawanId);
      }

      const { data: usersData } = await supabaseAdmin
        .from('users')
        .select('id, nama')
        .in('id', [...new Set(userIds)]);

      const userMap = {};
      usersData?.forEach((u) => { userMap[u.id] = u; });

      for (const item of skorData) {
        const match = matchMap[item.match_id];
        if (!match) continue;
        const user = userMap[item.input_by];
        if (!user) continue;
        const lawanId = match.challenger_id === item.input_by ? match.challenged_id : match.challenger_id;
        const lawan = userMap[lawanId];
        const lawanNama = lawan?.nama || 'lawan';
        feed.push({
          seed: user.id,
          nama: user.nama,
          aksi: `menang ${item.skor_sendiri}-${item.skor_lawan} vs ${lawanNama}`,
          rank: '',
          waktu: formatRelativeTime(item.created_at),
        });
      }
    }
  } catch (err) {
    console.error('Feed error:', err);
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
          18 player aktif sekarang
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

      {/* Feed */}
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

      {feed.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 0',
            borderBottom:
              i < feed.length - 1 ? '0.5px solid #e5e5e5' : 'none',
          }}
        >
          <img
            src={`https://picsum.photos/seed/${item.seed}/34/34`}
            alt={item.nama}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '4px',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, fontSize: '13px' }}>
            <strong>{item.nama}</strong> {item.aksi}
            {item.rank && (
              <span
                style={{
                  fontSize: '10px',
                  border: '0.5px solid #e5e5e5',
                  borderRadius: '3px',
                  padding: '1px 5px',
                  color: '#888',
                  marginLeft: '4px',
                }}
              >
                {item.rank}
              </span>
            )}
          </div>
          <span style={{ fontSize: '11px', color: '#aaa', flexShrink: 0 }}>
            {item.waktu}
          </span>
        </div>
      ))}
    </main>
  );
}