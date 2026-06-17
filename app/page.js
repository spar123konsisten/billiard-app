import Link from 'next/link';

export default function Home() {
  const leaderboard = [
    {seed:'a1', nama:'Raka', kota:'Bekasi', rank:'Maung ★★★', poin:'1.847'},
    {seed:'a2', nama:'Doni', kota:'Jakarta', rank:'Amok ★★', poin:'1.620'},
    {seed:'a3', nama:'Sari', kota:'Depok', rank:'Tuah ★★', poin:'1.480'},
    {seed:'a4', nama:'Bagus', kota:'Bekasi', rank:'Isen ★★★', poin:'1.210'},
    {seed:'a5', nama:'Hendra', kota:'Bogor', rank:'Tuah ★', poin:'1.190'},
  ]

  const feed = [
    {seed:'a1', nama:'Doni', aksi:'menang 3–1 vs Ari', rank:'Amok', waktu:'2 mnt'},
    {seed:'a3', nama:'Sari', aksi:'naik ke Tuah ★★', rank:'', waktu:'11 mnt'},
    {seed:'a4', nama:'Bagus', aksi:'menantang Raka · Bekasi', rank:'', waktu:'23 mnt'},
    {seed:'a2', nama:'Raka', aksi:'menang 5–2 vs Hendra', rank:'Maung', waktu:'1 jam'},
  ]

  return (
    <main style={{maxWidth:'420px', margin:'0 auto', padding:'24px 16px', fontFamily:'sans-serif'}}>

      {/* Live bar */}
      <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'24px'}}>
        <span style={{width:'6px', height:'6px', borderRadius:'50%', background:'#1D9E75', display:'inline-block'}}></span>
        <span style={{fontSize:'11px', color:'#888', letterSpacing:'1px', textTransform:'uppercase'}}>18 player aktif sekarang</span>
      </div>

      {/* Hero */}
      <h1 style={{fontSize:'28px', fontWeight:'500', lineHeight:'1.2', margin:'0 0 10px'}}>
        Tantang siapapun.<br/><span style={{borderBottom:'2px solid black'}}>Buktikan levelmu.</span>
      </h1>
      <p style={{fontSize:'14px', color:'#666', marginBottom:'20px', lineHeight:'1.6'}}>
        Platform sparring billiard pertama di Indonesia. Cari lawan, main, naik rank.
      </p>

      {/* CTA */}
      <Link href="/register" style={{ textDecoration: 'none' }}>
        <button style={{width:'100%', padding:'15px', background:'#000', color:'#fff', border:'none', borderRadius:'4px', fontSize:'15px', fontWeight:'500', display:'flex', justifyContent:'space-between', cursor:'pointer', marginBottom:'32px'}}>
          <span>Daftar & cari lawan</span><span>→</span>
        </button>
      </Link>

      {/* Stats */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'32px'}}>
        <div style={{border:'0.5px solid #e5e5e5', borderRadius:'4px', padding:'14px'}}>
          <span style={{fontSize:'28px', fontWeight:'500', display:'block', lineHeight:'1', marginBottom:'4px'}}>47</span>
          <span style={{fontSize:'11px', color:'#888'}}>Player cari lawan sekarang</span>
        </div>
        <div style={{border:'0.5px solid #e5e5e5', borderRadius:'4px', padding:'14px'}}>
          <span style={{fontSize:'28px', fontWeight:'500', display:'block', lineHeight:'1', marginBottom:'4px'}}>1.240</span>
          <span style={{fontSize:'11px', color:'#888'}}>Match dimainkan</span>
        </div>
      </div>

      <hr style={{border:'none', borderTop:'0.5px solid #e5e5e5', marginBottom:'24px'}}/>

      {/* Leaderboard tanpa kolom Poin */}
      <p style={{fontSize:'10px', color:'#aaa', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'12px'}}>Top player minggu ini</p>

      {/* Header: #, Player, Rank */}
      <div style={{display:'grid', gridTemplateColumns:'24px 1fr 90px', gap:'8px', paddingBottom:'8px', borderBottom:'0.5px solid #e5e5e5', marginBottom:'4px'}}>
        <span style={{fontSize:'10px', color:'#aaa', letterSpacing:'1px', textTransform:'uppercase'}}>#</span>
        <span style={{fontSize:'10px', color:'#aaa', letterSpacing:'1px', textTransform:'uppercase'}}>Player</span>
        <span style={{fontSize:'10px', color:'#aaa', letterSpacing:'1px', textTransform:'uppercase'}}>Rank</span>
      </div>

      {leaderboard.map((p, i) => (
        <div key={i} style={{display:'grid', gridTemplateColumns:'24px 1fr 90px', gap:'8px', alignItems:'center', padding:'10px 0', borderBottom: i < leaderboard.length-1 ? '0.5px solid #e5e5e5' : 'none', background: i===0 ? '#f9f9f9' : 'transparent'}}>
          <span style={{fontSize:'13px', fontWeight:'500', color: i===0 ? '#BA7517' : '#888'}}>{i+1}</span>
          <div style={{display:'flex', alignItems:'center', gap:'8px', minWidth:0}}>
            <img src={`https://picsum.photos/seed/${p.seed}/30/30`} alt={p.nama} style={{width:'30px', height:'30px', borderRadius:'3px', objectFit:'cover', flexShrink:0}}/>
            <div>
              <div style={{fontSize:'13px', fontWeight:'500', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{p.nama}</div>
              <div style={{fontSize:'11px', color:'#888'}}>{p.kota}</div>
            </div>
          </div>
          <span style={{fontSize:'10px', border:'0.5px solid #e5e5e5', borderRadius:'3px', padding:'2px 5px', color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{p.rank}</span>
        </div>
      ))}

      {/* Link ke registrasi */}
      <Link href="/register" style={{ textDecoration: 'none' }}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', padding:'14px', border:'0.5px dashed #ccc', borderRadius:'4px', marginTop:'12px', marginBottom:'32px', cursor:'pointer'}}>
          <span style={{fontSize:'13px', color:'#888'}}>#??? —</span>
          <span style={{fontSize:'13px', fontWeight:'500'}}>Posisi lo di mana? Daftar →</span>
        </div>
      </Link>

      <hr style={{border:'none', borderTop:'0.5px solid #e5e5e5', marginBottom:'24px'}}/>

      {/* Feed */}
      <p style={{fontSize:'10px', color:'#aaa', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:'10px'}}>Baru saja terjadi</p>

      {feed.map((item, i) => (
        <div key={i} style={{display:'flex', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom: i < feed.length-1 ? '0.5px solid #e5e5e5' : 'none'}}>
          <img src={`https://picsum.photos/seed/${item.seed}/34/34`} alt={item.nama} style={{width:'34px', height:'34px', borderRadius:'4px', objectFit:'cover', flexShrink:0}}/>
          <div style={{flex:1, fontSize:'13px'}}>
            <strong>{item.nama}</strong> {item.aksi}
            {item.rank && <span style={{fontSize:'10px', border:'0.5px solid #e5e5e5', borderRadius:'3px', padding:'1px 5px', color:'#888', marginLeft:'4px'}}>{item.rank}</span>}
          </div>
          <span style={{fontSize:'11px', color:'#aaa', flexShrink:0}}>{item.waktu}</span>
        </div>
      ))}

    </main>
  )
}