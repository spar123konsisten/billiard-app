'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import html2canvas from 'html2canvas';

const cardStyle = {
  border: '0.5px solid #e5e5e5',
  borderRadius: '4px',
  padding: '16px',
  marginBottom: '12px',
  width: '100%',
  boxSizing: 'border-box',
};

const imgStyle = {
  width: '48px',
  height: '48px',
  borderRadius: '4px',
  objectFit: 'cover',
  flexShrink: 0,
};

export default function PertandinganContent() {
  const searchParams = useSearchParams();
  const sent = searchParams.get('sent');
  const waLink = searchParams.get('wa');
  const [showSuccess, setShowSuccess] = useState(false);

  const [activeTab, setActiveTab] = useState('ajakan');
  const [ajakanData, setAjakanData] = useState([]);
  const [terjadwalData, setTerjadwalData] = useState([]);
  const [riwayatData, setRiwayatData] = useState([]);
  const [loadingAjakan, setLoadingAjakan] = useState(false);
  const [loadingTerjadwal, setLoadingTerjadwal] = useState(false);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [modal, setModal] = useState({ show: false, matchId: null, opponentName: '', skorSendiri: '', skorLawan: '' });
  const [shareModal, setShareModal] = useState({ show: false, matchData: null });
  const [userStats, setUserStats] = useState({ nama: '', username: '', kota: '', foto_url: '', tier: 'rintis', bintang: 0, streak: 0, winrate: 0, rank_kota: 0 });
  const [downloading, setDownloading] = useState(false);

  const activeTabRef = useRef(activeTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // Ambil data user
  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        const res = await fetch('/api/user/me');
        if (res.ok) {
          const data = await res.json();
          setUserStats(prev => ({ ...prev, ...data }));
        }
      } catch (err) { console.error(err); }
    };
    fetchUserStats();
  }, []);

  const fetchAjakan = async () => {
    setLoadingAjakan(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/pertandingan?tab=ajakan');
      const result = await res.json();
      if (!res.ok) setErrorMsg(result.error || 'Gagal memuat data');
      else setAjakanData(result.data || []);
    } catch (err) { setErrorMsg('Error: ' + err.message); }
    finally { setLoadingAjakan(false); }
  };

  const fetchTerjadwal = async () => {
    setLoadingTerjadwal(true);
    try {
      const res = await fetch('/api/pertandingan?tab=terjadwal');
      const result = await res.json();
      if (res.ok) setTerjadwalData(result.data || []);
    } catch (err) { console.error(err); }
    finally { setLoadingTerjadwal(false); }
  };

  const fetchRiwayat = async () => {
    setLoadingRiwayat(true);
    try {
      const res = await fetch('/api/pertandingan?tab=riwayat');
      const result = await res.json();
      if (res.ok) setRiwayatData(result.data || []);
    } catch (err) { console.error(err); }
    finally { setLoadingRiwayat(false); }
  };

  const checkExpired = async () => {
    try {
      await fetch('/api/pertandingan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_expired' }),
      });
      if (activeTabRef.current === 'terjadwal') fetchTerjadwal();
      if (activeTabRef.current === 'riwayat') fetchRiwayat();
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    let interval;
    if (activeTab === 'ajakan') {
      fetchAjakan();
      interval = setInterval(fetchAjakan, 30000);
    } else if (activeTab === 'terjadwal') {
      fetchTerjadwal();
      interval = setInterval(() => { checkExpired(); fetchTerjadwal(); }, 300000);
    } else if (activeTab === 'riwayat') {
      fetchRiwayat();
    }
    return () => { if (interval) clearInterval(interval); };
  }, [activeTab]);

  useEffect(() => {
    if (sent === 'true') {
      setShowSuccess(true);
      if (waLink) {
        window.location.href = waLink;
        const url = new URL(window.location);
        url.searchParams.delete('sent');
        url.searchParams.delete('wa');
        window.history.replaceState({}, '', url);
      }
    }
  }, [sent, waLink]);

  const handleTerima = async (item) => {
    if (!item.opponent) return alert('Data lawan tidak valid');
    const res = await fetch('/api/pertandingan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'terima', matchId: item.id, challengerNama: item.opponent.nama, challengerNoWa: item.opponent.no_wa, tanggal: item.tanggal, waktu: item.waktu, lokasi: item.lokasi }),
    });
    const result = await res.json();
    if (result.success && result.waLink) { window.location.href = result.waLink; fetchAjakan(); }
    else alert('Gagal menerima ajakan: ' + (result.error || ''));
  };

  const handleTolak = async (item) => {
    if (!item.opponent) return alert('Data lawan tidak valid');
    const res = await fetch('/api/pertandingan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tolak', matchId: item.id, challengerNama: item.opponent.nama, challengerNoWa: item.opponent.no_wa, tanggal: item.tanggal, waktu: item.waktu }),
    });
    const result = await res.json();
    if (result.success && result.waLink) { window.location.href = result.waLink; fetchAjakan(); }
    else alert('Gagal menolak: ' + (result.error || ''));
  };

  const handleInputSkor = (matchId, opponentName) => {
    setModal({ show: true, matchId, opponentName, skorSendiri: '', skorLawan: '' });
  };

  const submitSkor = async () => {
    if (!modal.skorSendiri || !modal.skorLawan) return alert('Isi kedua skor');
    const res = await fetch('/api/pertandingan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skor', matchId: modal.matchId, skorSendiri: parseInt(modal.skorSendiri), skorLawan: parseInt(modal.skorLawan) }),
    });
    const result = await res.json();
    if (result.success) {
      alert(result.message);
      setModal({ show: false, matchId: null, opponentName: '', skorSendiri: '', skorLawan: '' });
      fetchTerjadwal(); fetchRiwayat();
    } else alert(result.error || 'Gagal input skor');
  };

  const openShare = (match) => setShareModal({ show: true, matchData: match });
  const closeShare = () => setShareModal({ show: false, matchData: null });

  const downloadShare = async () => {
    const card = document.getElementById('shareCardHidden');
    if (!card) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(card, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0a0a0a',
        width: 270,
        height: 480,
      });
      const link = document.createElement('a');
      link.download = `billiard-${shareModal.matchData?.hasil?.toLowerCase() || 'match'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      alert('Gagal: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const getScoreString = (match) => {
    if (match?.skor && match.skor !== '-') return match.skor;
    return '–';
  };

  const bintangStr = (n) => '★'.repeat(Math.max(0, Math.min(5, n || 0)));

  const countAjakan = ajakanData.length;
  const countTerjadwal = terjadwalData.length;

  const tabBtn = (key, label, count) => (
    <button onClick={() => setActiveTab(key)} style={{ flex: 1, background: 'none', border: 'none', padding: '10px 0', fontSize: '14px', fontWeight: activeTab === key ? '600' : '400', color: activeTab === key ? '#000' : '#888', cursor: 'pointer', borderBottom: activeTab === key ? '1.5px solid #000' : 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
      {label}
      {activeTab !== key && count > 0 && <span style={{ background: '#000', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '3px' }}>{count}</span>}
    </button>
  );

  // Card style untuk hidden div
  const hiddenCardContent = {
    width: '270px',
    height: '480px',
    background: '#0a0a0a',
    borderRadius: '16px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: '24px',
    color: '#fff',
    fontFamily: 'sans-serif',
    boxSizing: 'border-box',
  };

  return (
    <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px 80px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '26px', fontWeight: '500', marginBottom: '24px' }}>Pertandingan</h1>

      {showSuccess && (
        <div style={{ marginBottom: '16px', padding: '12px', background: '#e0f2e9', color: '#1d4e2d', borderRadius: '4px', textAlign: 'center', fontSize: '13px' }}>
          ✅ Ajakan berhasil dikirim!
        </div>
      )}

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid #e5e5e5', marginBottom: '24px' }}>
        {tabBtn('ajakan', 'Ajakan', countAjakan)}
        {tabBtn('terjadwal', 'Terjadwal', countTerjadwal)}
        {tabBtn('riwayat', 'Riwayat', 0)}
      </div>

      {/* TAB AJAKAN */}
      {activeTab === 'ajakan' && (
        <>
          {loadingAjakan && <p style={{ color: '#888', fontSize: '13px' }}>Memuat...</p>}
          {errorMsg && <p style={{ color: 'red', fontSize: '13px' }}>{errorMsg}</p>}
          {!loadingAjakan && !errorMsg && ajakanData.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: '13px' }}>Tidak ada ajakan.</div>}
          {ajakanData.map(item => {
            if (!item.opponent) return null;
            return (
              <div key={item.id} style={cardStyle}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <img src={item.opponent.foto_url || `https://picsum.photos/seed/${item.opponent.id}/48/48`} alt={item.opponent.nama} style={imgStyle} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '2px' }}>{item.opponent.nama}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>{item.opponent.tier} {bintangStr(item.opponent.bintang)}</div>
                    <div style={{ fontSize: '12px', fontWeight: '500', marginTop: '4px', color: '#333' }}>{item.tanggal} · {item.waktu}</div>
                  </div>
                </div>
                {item.userRole === 'challenged' && (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button onClick={() => handleTolak(item)} style={{ padding: '8px 20px', background: '#fff', border: '0.5px solid #e5e5e5', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Tolak</button>
                    <button onClick={() => handleTerima(item)} style={{ padding: '8px 20px', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Terima</button>
                  </div>
                )}
                {item.userRole === 'challenger' && (
                  <div style={{ fontSize: '12px', color: '#aaa', textAlign: 'right', marginTop: '10px' }}>Menunggu respons {item.opponent.nama}...</div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* TAB TERJADWAL */}
      {activeTab === 'terjadwal' && (
        <>
          {loadingTerjadwal && <p style={{ color: '#888', fontSize: '13px' }}>Memuat...</p>}
          {!loadingTerjadwal && terjadwalData.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: '13px' }}>Tidak ada pertandingan terjadwal.</div>}
          {terjadwalData.map(item => (
            <div key={item.id} style={cardStyle}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <img src={item.opponent.foto_url || `https://picsum.photos/seed/${item.opponent.id}/48/48`} alt={item.opponent.nama} style={imgStyle} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '2px' }}>vs {item.opponent.nama}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{item.opponent.tier} {bintangStr(item.opponent.bintang)}</div>
                  <div style={{ fontSize: '12px', fontWeight: '500', marginTop: '4px', color: '#333' }}>{item.tanggal} · {item.waktu}</div>
                </div>
              </div>
              {item.reminder && <div style={{ color: '#f39c12', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>⚠️ Batas input skor H+2. Segera input!</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button onClick={() => handleInputSkor(item.id, item.opponent.nama)} style={{ padding: '8px 20px', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Input Skor →</button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* TAB RIWAYAT */}
      {activeTab === 'riwayat' && (
        <>
          {loadingRiwayat && <p style={{ color: '#888', fontSize: '13px' }}>Memuat...</p>}
          {!loadingRiwayat && riwayatData.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: '13px' }}>Belum ada riwayat.</div>}
          {riwayatData.map(item => {
            const isWin = item.hasil === 'Menang';
            return (
              <div key={item.id} style={cardStyle}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <img src={item.opponent.foto_url || `https://picsum.photos/seed/${item.id}/48/48`} alt={item.opponent.nama} style={imgStyle} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '2px' }}>vs {item.opponent.nama} · {item.opponent.tier}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>{item.tanggal}</div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: isWin ? '#1D9E75' : item.hasil === 'Kalah' ? '#D32F2F' : '#888' }}>
                      {item.hasil} {item.skor !== '-' ? item.skor : ''}
                    </div>
                  </div>
                  <button onClick={() => openShare(item)} title="Bagikan" style={{ background: 'none', border: '0.5px solid #e5e5e5', borderRadius: '6px', cursor: 'pointer', padding: '6px 8px', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* HIDDEN CARD — untuk html2canvas */}
      <div
        id="shareCardHidden"
        style={{
          ...hiddenCardContent,
          position: 'fixed',
          left: '-9999px',
          top: 0,
        }}
      >
<div style={{ fontSize:'10px', fontWeight:'600', letterSpacing:'2px', textTransform:'uppercase', color: shareModal.matchData?.hasil==='Menang'?'#4CAF50':'#EF5350', marginBottom:'-20px' }}>
          {shareModal.matchData?.hasil || ''}
        </div>

        <div style={{ fontSize:'66px', fontWeight:'700', lineHeight:1, letterSpacing:'-2px', marginBottom:'28px' }}>
          {shareModal.matchData ? getScoreString(shareModal.matchData) : ''}
        </div>

        <div style={{ fontSize:'13px', color:'rgb(255, 255, 255)', marginBottom:'8px' }}>
          vs {shareModal.matchData?.opponent?.nama} · {shareModal.matchData?.opponent?.tier} {bintangStr(shareModal.matchData?.opponent?.bintang || 0)}
        </div>
        <div style={{ width:'40px', height:'1px', background:'rgb(255, 255, 255)', marginBottom:'1px' }} />

        <div style={{ fontSize:'13px', color:'rgb(255, 255, 255)', fontFamily:'monospace', marginBottom:'2px' }}>
          sparring.id/u/{userStats?.username || ''}
        </div>

        <div style={{ fontSize:'13px', color:'rgb(255, 255, 255)', letterSpacing:'1.5px', textTransform:'uppercase' }}>
          billiard.id
        </div>
      </div>

      {/* MODAL INPUT SKOR */}
      {modal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', width: '280px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Input Skor vs {modal.opponentName}</h3>
            <input type="number" placeholder="Skor kamu" value={modal.skorSendiri} onChange={e => setModal({ ...modal, skorSendiri: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '8px', border: '0.5px solid #e5e5e5', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }} />
            <input type="number" placeholder="Skor lawan" value={modal.skorLawan} onChange={e => setModal({ ...modal, skorLawan: e.target.value })} style={{ width: '100%', padding: '10px', marginBottom: '16px', border: '0.5px solid #e5e5e5', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }} />
            <button onClick={submitSkor} style={{ width: '100%', padding: '10px', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', marginBottom: '8px' }}>Simpan</button>
            <button onClick={() => setModal({ show: false, matchId: null, opponentName: '', skorSendiri: '', skorLawan: '' })} style={{ width: '100%', padding: '10px', background: '#f5f5f5', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>Batal</button>
          </div>
        </div>
      )}

      {/* SHARE CARD OVERLAY — preview hanya tampilan */}
      {shareModal.show && shareModal.matchData && (
        <div onClick={closeShare} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(6px)', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>

            <button onClick={closeShare} style={{ position: 'absolute', top: '-44px', right: '0', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer', padding: '4px 12px', borderRadius: '20px' }}>✕</button>

            <div style={{ ...hiddenCardContent, position: 'relative', margin: '0 auto', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', visibility: 'visible' }}>
              <div style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '2px', textTransform: 'uppercase', color: shareModal.matchData.hasil === 'Menang' ? '#4CAF50' : '#EF5350', marginBottom: '4px' }}>
                {shareModal.matchData.hasil}
              </div>
              <div style={{ fontSize: '72px', fontWeight: '700', lineHeight: 1, letterSpacing: '-2px', marginBottom: '6px' }}>
                {getScoreString(shareModal.matchData)}
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
                vs {shareModal.matchData.opponent?.nama} · {shareModal.matchData.opponent?.tier} {bintangStr(shareModal.matchData.opponent?.bintang || 0)}
              </div>
              <div style={{ width: '40px', height: '1px', background: 'rgba(255,255,255,0.2)', marginBottom: '9px' }} />
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', marginBottom: '2px' }}>
                sparring.id/u/{userStats?.username || ''}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.18)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                billiard.id
              </div>
            </div>

            <button onClick={downloadShare} disabled={downloading} style={{ display: 'block', width: '100%', marginTop: '16px', padding: '14px', background: '#fff', border: 'none', borderRadius: '30px', fontWeight: '600', fontSize: '15px', color: '#000', cursor: downloading ? 'default' : 'pointer', opacity: downloading ? 0.7 : 1 }}>
              {downloading ? 'Menyiapkan...' : '⬇️ Download & Share'}
            </button>

          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '0.5px solid #e5e5e5', padding: '8px 16px 12px', maxWidth: '420px', margin: '0 auto', display: 'flex', justifyContent: 'space-around' }}>
        <Link href="/home" style={{ textDecoration: 'none', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', filter: 'grayscale(1)' }}>🏠</div>
          <div style={{ fontSize: '11px', color: '#888' }}>Home</div>
        </Link>
        <Link href="/ranking" style={{ textDecoration: 'none', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', filter: 'grayscale(1)' }}>🏆</div>
          <div style={{ fontSize: '11px', color: '#888' }}>Ranking</div>
        </Link>
        <Link href="/pertandingan" style={{ textDecoration: 'none', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', filter: 'grayscale(1)' }}>⚔️</div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#000' }}>Pertandingan</div>
        </Link>
        <Link href="/akun" style={{ textDecoration: 'none', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', filter: 'grayscale(1)' }}>👤</div>
          <div style={{ fontSize: '11px', color: '#888' }}>Akun</div>
        </Link>
      </div>
    </main>
  );
}