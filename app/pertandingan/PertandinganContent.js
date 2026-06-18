'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const cardStyle = {
  border: '0.5px solid #e5e5e5',
  borderRadius: '4px',
  padding: '16px',
  marginBottom: '16px',
  width: '100%',
  boxSizing: 'border-box',
};

const imgStyle = {
  width: '56px',
  height: '56px',
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

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // --- Fetch functions ---
  const fetchAjakan = async () => {
    setLoadingAjakan(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/pertandingan?tab=ajakan');
      const result = await res.json();
      if (!res.ok) setErrorMsg(result.error || 'Gagal memuat data');
      else setAjakanData(result.data || []);
    } catch (err) { setErrorMsg('Error koneksi: ' + err.message); }
    finally { setLoadingAjakan(false); }
  };

  const fetchTerjadwal = async () => {
    setLoadingTerjadwal(true);
    try {
      const res = await fetch('/api/pertandingan?tab=terjadwal');
      const result = await res.json();
      if (res.ok) setTerjadwalData(result.data || []);
      else console.error(result.error);
    } catch (err) { console.error(err); }
    finally { setLoadingTerjadwal(false); }
  };

  const fetchRiwayat = async () => {
    setLoadingRiwayat(true);
    try {
      const res = await fetch('/api/pertandingan?tab=riwayat');
      const result = await res.json();
      if (res.ok) setRiwayatData(result.data || []);
      else console.error(result.error);
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

  // --- POLLING sesuai tab ---
  useEffect(() => {
    let interval;

    if (activeTab === 'ajakan') {
      fetchAjakan();
      interval = setInterval(fetchAjakan, 30000);
    } else if (activeTab === 'terjadwal') {
      fetchTerjadwal();
      interval = setInterval(() => {
        checkExpired();
        fetchTerjadwal();
      }, 300000);
    } else if (activeTab === 'riwayat') {
      fetchRiwayat();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab]);

  // --- Notifikasi WA ---
  useEffect(() => {
    if (sent === 'true') {
      setShowSuccess(true);
      if (waLink) {
        // ✅ PERBAIKAN: buka langsung tanpa popup
        window.location.href = waLink;
        // Hapus parameter dari URL setelah membuka WA
        const url = new URL(window.location);
        url.searchParams.delete('sent');
        url.searchParams.delete('wa');
        window.history.replaceState({}, '', url);
      }
    }
  }, [sent, waLink]);

  // --- Handlers ---
  const handleTerima = async (item) => {
    if (!item.opponent) return alert('Data lawan tidak valid');
    const res = await fetch('/api/pertandingan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'terima',
        matchId: item.id,
        challengerNama: item.opponent.nama,
        challengerNoWa: item.opponent.no_wa,
        tanggal: item.tanggal,
        waktu: item.waktu,
        lokasi: item.lokasi,
      }),
    });
    const result = await res.json();
    if (result.success && result.waLink) {
      // ✅ PERBAIKAN: buka langsung tanpa popup
      window.location.href = result.waLink;
      fetchAjakan();
    } else {
      alert('Gagal menerima ajakan: ' + (result.error || ''));
    }
  };

  const handleTolak = async (item) => {
    if (!item.opponent) return alert('Data lawan tidak valid');
    const res = await fetch('/api/pertandingan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'tolak',
        matchId: item.id,
        challengerNama: item.opponent.nama,
        challengerNoWa: item.opponent.no_wa,
        tanggal: item.tanggal,
        waktu: item.waktu,
      }),
    });
    const result = await res.json();
    if (result.success && result.waLink) {
      // ✅ PERBAIKAN: buka langsung tanpa popup
      window.location.href = result.waLink;
      fetchAjakan();
    } else {
      alert('Gagal menolak ajakan: ' + (result.error || ''));
    }
  };

  const handleInputSkor = (matchId, opponentName) => {
    setModal({ show: true, matchId, opponentName, skorSendiri: '', skorLawan: '' });
  };

  const submitSkor = async () => {
    if (!modal.skorSendiri || !modal.skorLawan) return alert('Isi kedua skor');
    const res = await fetch('/api/pertandingan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'skor',
        matchId: modal.matchId,
        skorSendiri: parseInt(modal.skorSendiri),
        skorLawan: parseInt(modal.skorLawan),
      }),
    });
    const result = await res.json();
    if (result.success) {
      alert(result.message);
      setModal({ show: false, matchId: null, opponentName: '', skorSendiri: '', skorLawan: '' });
      fetchTerjadwal();
      fetchRiwayat();
    } else {
      alert(result.error || 'Gagal input skor');
    }
  };

  const countAjakan = ajakanData.length;
  const countTerjadwal = terjadwalData.length;
  const countRiwayat = riwayatData.length;

  return (
    <main style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px 80px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '28px', fontWeight: '500', marginBottom: '24px' }}>Pertandingan</h1>

      {showSuccess && (
        <div style={{ marginBottom: '16px', padding: '12px', background: '#e0f2e9', color: '#1d4e2d', borderRadius: '4px', textAlign: 'center' }}>
          ✅ Ajakan berhasil dikirim! WhatsApp akan terbuka.
        </div>
      )}

      <div style={{ display: 'flex', borderBottom: '0.5px solid #e5e5e5', marginBottom: '24px' }}>
        <button onClick={() => setActiveTab('ajakan')} style={{ flex:1, background:'none', border:'none', padding:'10px 0', fontSize:'14px', fontWeight: activeTab === 'ajakan' ? '600' : '400', color: activeTab === 'ajakan' ? '#000' : '#888', cursor:'pointer', borderBottom: activeTab === 'ajakan' ? '1px solid #000' : 'none', display:'flex', justifyContent:'center', alignItems:'center', gap:'6px' }}>
          Ajakan
          {activeTab !== 'ajakan' && countAjakan > 0 && (
            <span style={{ background:'#000', color:'#fff', fontSize:'10px', padding:'2px 6px', borderRadius:'3px' }}>
              {countAjakan}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('terjadwal')} style={{ flex:1, background:'none', border:'none', padding:'10px 0', fontSize:'14px', fontWeight: activeTab === 'terjadwal' ? '600' : '400', color: activeTab === 'terjadwal' ? '#000' : '#888', cursor:'pointer', borderBottom: activeTab === 'terjadwal' ? '1px solid #000' : 'none', display:'flex', justifyContent:'center', alignItems:'center', gap:'6px' }}>
          Terjadwal
          {activeTab !== 'terjadwal' && countTerjadwal > 0 && (
            <span style={{ background:'#000', color:'#fff', fontSize:'10px', padding:'2px 6px', borderRadius:'3px' }}>
              {countTerjadwal}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('riwayat')} style={{ flex:1, background:'none', border:'none', padding:'10px 0', fontSize:'14px', fontWeight: activeTab === 'riwayat' ? '600' : '400', color: activeTab === 'riwayat' ? '#000' : '#888', cursor:'pointer', borderBottom: activeTab === 'riwayat' ? '1px solid #000' : 'none', display:'flex', justifyContent:'center', alignItems:'center', gap:'6px' }}>
          Riwayat
          {activeTab !== 'riwayat' && countRiwayat > 0 && (
            <span style={{ background:'#000', color:'#fff', fontSize:'10px', padding:'2px 6px', borderRadius:'3px' }}>
              {countRiwayat}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'ajakan' && (
        <>
          {loadingAjakan && <p>Memuat ajakan...</p>}
          {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}
          {!loadingAjakan && !errorMsg && ajakanData.length === 0 && <div style={{ textAlign:'center', padding:'40px 0', color:'#888' }}>Tidak ada ajakan.</div>}
          {ajakanData.map(item => {
            if (!item.opponent) return null;
            return (
              <div key={item.id} style={cardStyle}>
                <div style={{ display:'flex', gap:'12px' }}>
                  <img src={item.opponent.foto_url || `https://picsum.photos/seed/${item.opponent.id}/56/56`} alt={item.opponent.nama} style={imgStyle} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:'600', fontSize:'16px', marginBottom:'4px' }}>{item.opponent.nama}</div>
                    <div style={{ fontSize:'12px', color:'#666' }}>{item.opponent.tier} {'★'.repeat(item.opponent.bintang)}</div>
                    <div style={{ fontSize:'13px', fontWeight:'500', marginTop:'6px' }}>{item.tanggal}, {item.waktu} · {item.lokasi}</div>
                  </div>
                </div>
                {item.userRole === 'challenged' && (
                  <div style={{ display:'flex', gap:'12px', justifyContent:'flex-end', marginTop:'12px' }}>
                    <button onClick={() => handleTolak(item)} style={{ padding:'8px 20px', background:'#fff', border:'0.5px solid #e5e5e5', borderRadius:'4px', cursor:'pointer' }}>Tolak</button>
                    <button onClick={() => handleTerima(item)} style={{ padding:'8px 20px', background:'#000', color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer' }}>Terima</button>
                  </div>
                )}
                {item.userRole === 'challenger' && (
                  <div style={{ fontSize:'12px', color:'#888', textAlign:'right', marginTop:'12px' }}>
                    Menunggu respons dari {item.opponent.nama}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {activeTab === 'terjadwal' && (
        <>
          {loadingTerjadwal && <p>Memuat...</p>}
          {!loadingTerjadwal && terjadwalData.length === 0 && <div style={{ textAlign:'center', padding:'40px 0', color:'#888' }}>Tidak ada pertandingan terjadwal.</div>}
          {terjadwalData.map(item => (
            <div key={item.id} style={cardStyle}>
              <div style={{ display:'flex', gap:'12px' }}>
                <img src={item.opponent.foto_url || `https://picsum.photos/seed/${item.opponent.id}/56/56`} alt={item.opponent.nama} style={imgStyle} />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:'600', fontSize:'16px', marginBottom:'4px' }}>vs {item.opponent.nama}</div>
                  <div style={{ fontSize:'12px', color:'#666' }}>{item.opponent.tier} {'★'.repeat(item.opponent.bintang)}</div>
                  <div style={{ fontSize:'13px', fontWeight:'500', marginTop:'6px' }}>{item.tanggal}, {item.waktu} · {item.lokasi}</div>
                </div>
              </div>
              {item.reminder && (
                <div style={{ color: '#f39c12', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>
                  ⚠️ Ingat! Batas waktu input skor H+2. Segera input skor.
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'12px' }}>
                <button onClick={() => handleInputSkor(item.id, item.opponent.nama)} style={{ padding:'8px 20px', background:'#000', color:'#fff', border:'none', borderRadius:'4px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>Input Skor <span>→</span></button>
              </div>
            </div>
          ))}
        </>
      )}

      {activeTab === 'riwayat' && (
        <>
          {loadingRiwayat && <p>Memuat riwayat...</p>}
          {!loadingRiwayat && riwayatData.length === 0 && <div style={{ textAlign:'center', padding:'40px 0', color:'#888' }}>Belum ada riwayat.</div>}
          {riwayatData.map(item => {
            const isWin = item.hasil === 'Menang';
            return (
              <div key={item.id} style={cardStyle}>
                <div style={{ display:'flex', gap:'12px' }}>
                  <img src={item.opponent.foto_url || `https://picsum.photos/seed/${item.id}/56/56`} alt={item.opponent.nama} style={imgStyle} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:'600', fontSize:'16px', marginBottom:'4px' }}>vs {item.opponent.nama} · {item.opponent.tier}</div>
                    <div style={{ fontSize:'12px', color:'#666', marginBottom:'2px' }}>{item.tanggal} · {item.lokasi}</div>
                    <div style={{ fontSize:'14px', fontWeight:'500', color: isWin ? '#1D9E75' : (item.hasil === 'Kalah' ? '#D32F2F' : '#888') }}>
                      {item.hasil} {item.skor !== '-' ? item.skor : ''}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {modal.show && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#fff', padding:'24px', borderRadius:'8px', width:'280px' }}>
            <h3>Input Skor vs {modal.opponentName}</h3>
            <input type="number" placeholder="Skor sendiri" value={modal.skorSendiri} onChange={e => setModal({...modal, skorSendiri: e.target.value})} style={{ width:'100%', padding:'8px', marginTop:'12px', border:'0.5px solid #ccc', borderRadius:'4px' }} />
            <input type="number" placeholder="Skor lawan" value={modal.skorLawan} onChange={e => setModal({...modal, skorLawan: e.target.value})} style={{ width:'100%', padding:'8px', marginTop:'12px', border:'0.5px solid #ccc', borderRadius:'4px' }} />
            <button onClick={submitSkor} style={{ width:'100%', padding:'8px', background:'#000', color:'#fff', border:'none', borderRadius:'4px', marginTop:'16px', cursor:'pointer' }}>Simpan</button>
            <button onClick={() => setModal({ show: false, matchId: null, opponentName: '', skorSendiri: '', skorLawan: '' })} style={{ width:'100%', padding:'8px', background:'#eee', border:'none', borderRadius:'4px', marginTop:'8px', cursor:'pointer' }}>Batal</button>
          </div>
        </div>
      )}

      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:'0.5px solid #e5e5e5', padding:'8px 16px 12px', maxWidth:'420px', margin:'0 auto', display:'flex', justifyContent:'space-around' }}>
        <Link href="/home" style={{ textDecoration:'none', textAlign:'center' }}>
          <div><div style={{ fontSize:'20px', filter:'grayscale(1)' }}>🏠</div><div style={{ fontSize:'11px', fontWeight:'600', color:'#000' }}>Home</div></div>
        </Link>
        <Link href="/ranking" style={{ textDecoration:'none', textAlign:'center' }}>
          <div><div style={{ fontSize:'20px', filter:'grayscale(1)' }}>🏆</div><div style={{ fontSize:'11px', color:'#888' }}>Ranking</div></div>
        </Link>
        <Link href="/pertandingan" style={{ textDecoration:'none', textAlign:'center' }}>
          <div><div style={{ fontSize:'20px', filter:'grayscale(1)' }}>⚔️</div><div style={{ fontSize:'11px', color:'#888' }}>Pertandingan</div></div>
        </Link>
        <Link href="/akun" style={{ textDecoration:'none', textAlign:'center' }}>
          <div><div style={{ fontSize:'20px', filter:'grayscale(1)' }}>👤</div><div style={{ fontSize:'11px', color:'#888' }}>Akun</div></div>
        </Link>
      </div>
    </main>
  );
}