'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LiveChat from '@/app/components/LiveChat'; // import LiveChat

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [jumlahAjakan, setJumlahAjakan] = useState(0);
  const [players, setPlayers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        if (!res.ok) throw new Error('Gagal memuat data');
        const data = await res.json();
        setUser(data.user);
        setJumlahAjakan(data.jumlahAjakan);
        setPlayers(data.players);
        setActivities(data.activities);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [router]);

  if (loading) {
    return (
      <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
        <p>Memuat dashboard...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
        <p style={{ color: 'red' }}>Error: {error}</p>
        <Link href="/login">Login kembali</Link>
      </main>
    );
  }

  const toggleView = () => {
    setViewMode(viewMode === 'list' ? 'grid' : 'list');
  };

  return (
    <main
      style={{
        maxWidth: '420px',
        margin: '0 auto',
        padding: '24px 16px 80px',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '500', margin: '0 0 4px' }}>
          Hei, {user?.nama}
        </h1>
        <div style={{ fontSize: '13px', color: '#888' }}>
          {user?.rank}
        </div>
      </div>

      {/* Card tantangan */}
      <Link href="/pertandingan" style={{ textDecoration: 'none' }}>
        <div
          style={{
            border: '0.5px solid #e5e5e5',
            padding: '16px',
            marginBottom: '32px',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <span style={{ fontWeight: '600', fontSize: '16px' }}>
              Ada yang mengajakmu ({jumlahAjakan})
            </span>
            <span style={{ fontSize: '13px', fontWeight: '500' }}>Lihat →</span>
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>
            Cek sekarang untuk melihat dan tanggapi ajakan.
          </div>
        </div>
      </Link>

      {/* Player cari lawan dengan toggle view */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2
            style={{
              fontSize: '14px',
              fontWeight: '500',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: '#aaa',
            }}
          >
            PLAYER CARI LAWAN
          </h2>
          <button
            onClick={toggleView}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '12px',
              color: '#888',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {viewMode === 'list' ? 'Grid □' : 'List ↓'}
          </button>
        </div>

        {players.length === 0 && <p style={{ fontSize: '13px', color: '#888' }}>Belum ada pemain.</p>}

        {viewMode === 'list' ? (
          players.slice(0, 5).map((p) => (
            <div
              key={p.seed}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 0',
                borderBottom: '0.5px solid #e5e5e5',
              }}
            >
              <Link href={`/u/${p.username}`} style={{ textDecoration: 'none' }}>
                <img
                  src={p.foto || `https://picsum.photos/seed/${p.seed}/40/40`}
                  alt={p.nama}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '0',
                    objectFit: 'cover',
                    cursor: 'pointer',
                  }}
                />
              </Link>
              <div>
                <Link href={`/u/${p.username}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{p.nama}</div>
                </Link>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {p.rank} · {p.kota}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
            }}
          >
            {players.slice(0, 6).map((p) => (
              <Link
                key={p.seed}
                href={`/u/${p.username}`}
                style={{ textDecoration: 'none' }}
              >
                <div
                  style={{
                    border: '0.5px solid #e5e5e5',
                    borderRadius: '4px',
                    padding: '8px',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <img
                    src={p.foto || `https://picsum.photos/seed/${p.seed}/160/120`}
                    alt={p.nama}
                    style={{
                      width: '100%',
                      height: 'auto',
                      aspectRatio: '4/3',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      marginBottom: '6px',
                    }}
                  />
                  <div style={{ fontWeight: '600', fontSize: '13px', color: '#000' }}>
                    {p.nama}
                  </div>
                  <div style={{ fontSize: '10px', color: '#666' }}>
                    {p.rank} · {p.kota}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {players.length > 5 && viewMode === 'list' && (
          <div style={{ marginTop: '12px', textAlign: 'right' }}>
            <Link
              href="/cari-lawan"
              style={{ fontSize: '13px', color: '#000', textDecoration: 'underline' }}
            >
              Lihat semua player →
            </Link>
          </div>
        )}
        {players.length > 6 && viewMode === 'grid' && (
          <div style={{ marginTop: '12px', textAlign: 'right' }}>
            <Link
              href="/cari-lawan"
              style={{ fontSize: '13px', color: '#000', textDecoration: 'underline' }}
            >
              Lihat semua player →
            </Link>
          </div>
        )}
      </div>

      {/* ===== LIVE CHAT GLOBAL (DITAMBAHKAN DI SINI) ===== */}
      <LiveChat 
        username={user?.nama || ''} 
        onlineCount={3} 
      />

      {/* Aktivitas terbaru */}
      <div style={{ marginBottom: '32px' }}>
        <h2
          style={{
            fontSize: '14px',
            fontWeight: '500',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: '#aaa',
            marginBottom: '12px',
          }}
        >
          AKTIVITAS TERBARU
        </h2>
        {activities.length === 0 && <p style={{ fontSize: '13px', color: '#888' }}>Belum ada aktivitas.</p>}
        {activities.slice(0, 10).map((act, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 0',
              borderBottom:
                idx < activities.length - 1 ? '0.5px solid #e5e5e5' : 'none',
            }}
          >
            <img
              src={`https://picsum.photos/seed/${act.seed}/40/40`}
              alt={act.nama}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '0',
                objectFit: 'cover',
              }}
            />
            <div style={{ flex: 1 }}>
              <div>
                <strong>{act.nama}</strong> {act.aksi}
                {act.rank && (
                  <span
                    style={{
                      fontSize: '10px',
                      border: '0.5px solid #e5e5e5',
                      padding: '1px 5px',
                      marginLeft: '6px',
                      color: '#888',
                    }}
                  >
                    {act.rank}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                {act.waktu}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Navigation */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTop: '0.5px solid #e5e5e5',
          padding: '8px 16px 12px',
          maxWidth: '420px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-around',
        }}
      >
        <Link href="/home" style={{ textDecoration: 'none', textAlign: 'center' }}>
          <div style={{ textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '20px', filter: 'grayscale(1)' }}>🏠</div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#000',
                marginTop: '2px',
              }}
            >
              Home
            </div>
          </div>
        </Link>
        <Link
          href="/ranking"
          style={{ textDecoration: 'none', textAlign: 'center' }}
        >
          <div style={{ textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '20px', filter: 'grayscale(1)' }}>🏆</div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
              Ranking
            </div>
          </div>
        </Link>
        <Link
          href="/pertandingan"
          style={{ textDecoration: 'none', textAlign: 'center' }}
        >
          <div style={{ textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '20px', filter: 'grayscale(1)' }}>⚔️</div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
              Pertandingan
            </div>
          </div>
        </Link>
        <Link href="/akun" style={{ textDecoration: 'none', textAlign: 'center' }}>
          <div style={{ textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '20px', filter: 'grayscale(1)' }}>👤</div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
              Akun
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}