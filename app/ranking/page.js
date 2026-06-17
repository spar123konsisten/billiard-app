// app/ranking/page.js
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function RankingPage() {
  const [activeTab, setActiveTab] = useState('nasional');
  const [selectedCity, setSelectedCity] = useState('Semua');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRank, setUserRank] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [cityOptions, setCityOptions] = useState(['Semua']);

  // Ambil daftar kota dari API /api/cities
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const res = await fetch('/api/cities');
        if (res.ok) {
          const data = await res.json();
          setCityOptions(['Semua', ...data]);
        }
      } catch (err) {
        console.error('Gagal ambil daftar kota');
      }
    };
    fetchCities();
  }, []);

  // Ambil data ranking berdasarkan tab dan kota terpilih
  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      setError('');
      try {
        let url = `/api/ranking?tab=${activeTab}`;
        if (activeTab === 'kota' && selectedCity !== 'Semua') {
          url += `&city=${encodeURIComponent(selectedCity)}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error('Gagal mengambil data');
        const data = await res.json();
        setUserRank(data.userRank);
        setLeaderboard(data.leaderboard);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRanking();
  }, [activeTab, selectedCity]);

  return (
    <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px 80px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '28px', fontWeight: '500', marginBottom: '24px' }}>Ranking</h1>

      {/* Tab navigasi */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid #e5e5e5', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('nasional')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            padding: '10px 0',
            fontSize: '14px',
            fontWeight: activeTab === 'nasional' ? '600' : '400',
            color: activeTab === 'nasional' ? '#000' : '#888',
            cursor: 'pointer',
            borderBottom: activeTab === 'nasional' ? '1px solid #000' : 'none',
          }}
        >
          Nasional
        </button>
        <button
          onClick={() => setActiveTab('kota')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            padding: '10px 0',
            fontSize: '14px',
            fontWeight: activeTab === 'kota' ? '600' : '400',
            color: activeTab === 'kota' ? '#000' : '#888',
            cursor: 'pointer',
            borderBottom: activeTab === 'kota' ? '1px solid #000' : 'none',
          }}
        >
          Kota
        </button>
        <button
          onClick={() => setActiveTab('mingguan')}
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            padding: '10px 0',
            fontSize: '14px',
            fontWeight: activeTab === 'mingguan' ? '600' : '400',
            color: activeTab === 'mingguan' ? '#000' : '#888',
            cursor: 'pointer',
            borderBottom: activeTab === 'mingguan' ? '1px solid #000' : 'none',
          }}
        >
          Mingguan
        </button>
      </div>

      {/* Filter kota (hanya untuk tab "Kota") */}
      {activeTab === 'kota' && (
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '0.5px solid #e5e5e5',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'inherit',
              background: '#fff',
            }}
          >
            {cityOptions.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
      )}

      {/* Loading & error */}
      {loading && <p>Memuat data...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Card posisi user */}
      {!loading && userRank && (
        <div
          style={{
            border: '0.5px solid #e5e5e5',
            borderRadius: '4px',
            padding: '16px',
            marginBottom: '24px',
            background: '#f9f9f9',
          }}
        >
          <div style={{ fontSize: '12px', color: '#888', letterSpacing: '1px', marginBottom: '4px' }}>
            #{userRank.rank} · POSISI ANDA
          </div>
          <div style={{ fontWeight: '600', fontSize: '16px' }}>
            {userRank.nama} · {userRank.tier}
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
            Streak {userRank.streak} menang
          </div>
        </div>
      )}

      {/* Tabel leaderboard */}
      {!loading && !error && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 40px 1fr 70px',
              gap: '8px',
              alignItems: 'center',
              paddingBottom: '8px',
              borderBottom: '0.5px solid #e5e5e5',
              marginBottom: '8px',
            }}
          >
            <span style={{ fontSize: '10px', color: '#aaa', letterSpacing: '1px' }}>#</span>
            <span></span>
            <span style={{ fontSize: '10px', color: '#aaa', letterSpacing: '1px' }}>Player</span>
            <span style={{ fontSize: '10px', color: '#aaa', letterSpacing: '1px' }}>Tier</span>
          </div>

          {leaderboard.map((item) => (
            <div
              key={item.rank}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 40px 1fr 70px',
                gap: '8px',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '0.5px solid #e5e5e5',
                background: item.isUser ? '#f9f9f9' : 'transparent',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: item.isUser ? '#BA7517' : '#888',
                }}
              >
                {item.rank}
              </span>
              <img
                src={item.foto}
                alt={item.nama}
                style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500' }}>{item.nama}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>{item.namaLengkap} · {item.kota}</div>
              </div>
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    border: '0.5px solid #e5e5e5',
                    borderRadius: '3px',
                    padding: '2px 5px',
                    color: '#888',
                  }}
                >
                  {item.tier}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

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
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#000', marginTop: '2px' }}>Home</div>
          </div>
        </Link>
        <Link href="/ranking" style={{ textDecoration: 'none', textAlign: 'center' }}>
          <div style={{ textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '20px', filter: 'grayscale(1)' }}>🏆</div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>Ranking</div>
          </div>
        </Link>
        <Link href="/pertandingan" style={{ textDecoration: 'none', textAlign: 'center' }}>
          <div style={{ textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '20px', filter: 'grayscale(1)' }}>⚔️</div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>Pertandingan</div>
          </div>
        </Link>
        <Link href="/akun" style={{ textDecoration: 'none', textAlign: 'center' }}>
          <div style={{ textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '20px', filter: 'grayscale(1)' }}>👤</div>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>Akun</div>
          </div>
        </Link>
      </div>
    </main>
  );
}