// app/cari-lawan/page.js
'use client';

import { useState } from 'react';

export default function CariLawanPage() {
  const allPlayers = [
    { seed: 'a1', nama: 'Raka', kota: 'Bekasi', tempat: 'Golden Billiard', rank: 'Maung', bintang: '★★★', poin: '1.847' },
    { seed: 'a2', nama: 'Doni', kota: 'Jakarta', tempat: 'Cue Masters', rank: 'Amok', bintang: '★★★', poin: '1.620' },
    { seed: 'a3', nama: 'Sari', kota: 'Depok', tempat: 'Break Point', rank: 'Tuah', bintang: '★★★', poin: '1.480' },
    { seed: 'a4', nama: 'Bagus', kota: 'Bekasi', tempat: 'Golden Billiard', rank: 'Isen', bintang: '★★★', poin: '1.210' },
    { seed: 'a5', nama: 'Hendra', kota: 'Bogor', tempat: 'Cue & Break', rank: 'Tuah', bintang: '★', poin: '1.190' },
    { seed: 'a6', nama: 'Yusuf', kota: 'Jakarta', tempat: 'Cue Masters', rank: 'Rintis', bintang: '★★★', poin: '980' },
  ];

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRank, setSelectedRank] = useState('Semua');
  const [layout, setLayout] = useState('list'); // 'list' atau 'grid'

  const ranks = ['Semua', 'Maung', 'Amok', 'Tuah', 'Isen', 'Rint'];

  const filteredPlayers = allPlayers.filter((player) => {
    const matchSearch =
      player.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.kota.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.tempat.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRank = selectedRank === 'Semua' || player.rank === selectedRank;
    return matchSearch && matchRank;
  });

  return (
    <main
      style={{
        maxWidth: '420px',
        margin: '0 auto',
        padding: '24px 16px 80px',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Tombol kembali */}
      <a
        href="/"
        style={{
          display: 'inline-block',
          marginBottom: '24px',
          fontSize: '13px',
          color: '#888',
          textDecoration: 'none',
          borderBottom: '0.5px solid #e5e5e5',
          paddingBottom: '4px',
        }}
      >
        ← Kembali
      </a>

      <h1 style={{ fontSize: '28px', fontWeight: '500', margin: '0 0 16px' }}>
        Cari Lawan
      </h1>

      {/* Search bar */}
      <input
        type="text"
        placeholder="Nama, kota, atau tempat billiard..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          width: '100%',
          padding: '12px',
          border: '0.5px solid #e5e5e5',
          borderRadius: '0',
          fontSize: '14px',
          marginBottom: '16px',
          outline: 'none',
        }}
      />

      {/* Filter ranks */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '16px',
        }}
      >
        {ranks.map((rank) => (
          <button
            key={rank}
            onClick={() => setSelectedRank(rank)}
            style={{
              padding: '6px 12px',
              background: selectedRank === rank ? '#000' : '#fff',
              color: selectedRank === rank ? '#fff' : '#000',
              border: '0.5px solid #e5e5e5',
              borderRadius: '0',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {rank}
          </button>
        ))}
      </div>

      {/* Toggle layout: List / Grid */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <button
          onClick={() => setLayout('list')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '12px',
            cursor: 'pointer',
            padding: '4px 8px',
            fontWeight: layout === 'list' ? '600' : '400',
            color: layout === 'list' ? '#000' : '#888',
            borderBottom: layout === 'list' ? '1px solid #000' : 'none',
          }}
        >
          List ↓
        </button>
        <button
          onClick={() => setLayout('grid')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '12px',
            cursor: 'pointer',
            padding: '4px 8px',
            fontWeight: layout === 'grid' ? '600' : '400',
            color: layout === 'grid' ? '#000' : '#888',
            borderBottom: layout === 'grid' ? '1px solid #000' : 'none',
          }}
        >
          Grid □
        </button>
      </div>

      {/* Jumlah player */}
      <div
        style={{
          fontSize: '12px',
          fontWeight: '500',
          letterSpacing: '1px',
          color: '#aaa',
          marginBottom: '16px',
        }}
      >
        {filteredPlayers.length} PLAYER CARI LAWAN SEKARANG
      </div>

      {/* Layout: LIST (baris ke bawah) */}
      {layout === 'list' && (
        <div>
          {filteredPlayers.map((player) => (
            <div
              key={player.seed}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '0.5px solid #e5e5e5',
                padding: '12px 0',
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <img
                  src={`https://picsum.photos/seed/${player.seed}/48/48`}
                  alt={player.nama}
                  style={{ width: '48px', height: '48px', borderRadius: '0', objectFit: 'cover' }}
                />
                <div>
                  <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>
                    {player.nama}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    {player.kota} · {player.tempat} · <strong>{player.rank}</strong> {player.bintang}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: '600' }}>{player.poin}</div>
                <div style={{ fontSize: '10px', color: '#888' }}>ELO</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Layout: GRID 2 kolom seperti YouTube thumbnail */}
      {layout === 'grid' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          {filteredPlayers.map((player) => (
            <div
              key={player.seed}
              style={{
                border: '0.5px solid #e5e5e5',
                padding: '8px',
                background: '#fff',
              }}
            >
              <img
                src={`https://picsum.photos/seed/${player.seed}/160/120`}
                alt={player.nama}
                style={{
                  width: '100%',
                  height: 'auto',
                  aspectRatio: '4/3',
                  objectFit: 'cover',
                  borderRadius: '0',
                  marginBottom: '8px',
                }}
              />
              <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>
                {player.nama}
              </div>
              <div style={{ fontSize: '10px', color: '#666', marginBottom: '2px' }}>
                {player.kota} · {player.tempat}
              </div>
              <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>
                {player.rank} {player.bintang}
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                {player.poin} <span style={{ fontSize: '9px', fontWeight: 'normal' }}>ELO</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredPlayers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
          Tidak ada player yang cocok.
        </div>
      )}
    </main>
  );
}