'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './AiChat.module.css';
import { useVoiceInput } from './useVoiceInput';

const QUICK_REPLIES = ['siapa peringkat 1?','top 5 pemain','siapa tier rintis?','refresh data'];

function getSessionId(){
  if(typeof window==='undefined') return null;
  let id=localStorage.getItem('ai_session_id');
  if(!id){ id=(crypto?.randomUUID?.()||'sess-'+Date.now()+'-'+Math.random().toString(36).slice(2)); localStorage.setItem('ai_session_id',id); }
  return id;
}
function clientFingerprint(q){ return q.toLowerCase().split(' ').filter(w=>w.length>2).sort().join('_'); }

export default function AiChat(){
  const [isOpen,setIsOpen]=useState(false);
  const [messages,setMessages]=useState([{role:'bot',text:'Halo! Saya asisten ranking.\n\nTanyakan tentang peringkat pemain, statistik, atau refresh data.\n\nTier: SURA → MAUNG → TUAH → AMOK → MENTENG → ISEN → RINTIS'}]);
  const [input,setInput]=useState('');
  const [loading,setLoading]=useState(false);
  const [reasonIdx,setReasonIdx]=useState(null);
  const [reasonText,setReasonText]=useState('');
  const messagesEndRef=useRef(null);

  // 👇 Hook voice DI DALAM KOMPONEN
  const voice = useVoiceInput({ onResult: (t) => sendMessage(t) });

  useEffect(()=>{ messagesEndRef.current?.scrollIntoView({behavior:'smooth'}); },[messages]);

  useEffect(()=>{
    if(isOpen){ document.body.style.overflow='hidden'; }
    else{ document.body.style.overflow=''; }
    return ()=>{ document.body.style.overflow=''; };
  },[isOpen]);

  const sendMessage=async(text)=>{
    const message=text||input.trim();
    if(!message||loading)return;
    setMessages(p=>[...p,{role:'user',text:message}]);
    setInput(''); setLoading(true);
    try{
      const res=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message,session_id:getSessionId(),username:(typeof window!=='undefined'&&localStorage.getItem('username'))||null})});
      const data=await res.json();
      if(data.success){
        setMessages(p=>[...p,{role:'bot',text:data.message,data:data.data,type:data.type,extra:data.extra,queryId:data.query_id||null,fingerprint:data.fingerprint||clientFingerprint(message),feedback:null}]);
      }else{
        setMessages(p=>[...p,{role:'bot',text:data.message||'Maaf, terjadi kesalahan.',fingerprint:clientFingerprint(message),feedback:null}]);
      }
    }catch(err){ setMessages(p=>[...p,{role:'bot',text:'Error: '+err.message,feedback:null}]); }
    finally{ setLoading(false); }
  };

  const sendFeedback=async(idx,feedback,reason=null)=>{
    const msg=messages[idx];
    try{
      await fetch('/api/ai/feedback',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({query_id:msg.queryId||null,fingerprint:msg.fingerprint||null,feedback,reason})});
      setMessages(p=>p.map((m,i)=>i===idx?{...m,feedback}:m));
    }catch(e){}
  };

  const buildCard=(p,i,noRank=false)=>{
    const tier=(p.tier||'').toLowerCase();
    const tierClass=styles[tier]||'';
    const bintang='⭐'.repeat(p.bintang||0)||'—';
    return `
      <div class="${styles.playerCard}">
        <div class="${styles.playerHeader}">
          <div class="${styles.playerAvatar}">
            ${p.foto_url?`<img src="${p.foto_url}" alt="${p.nama}" />`:`<span>${p.nama?.[0]?.toUpperCase()||'?'}</span>`}
          </div>
          <div class="${styles.playerInfo}">
            ${noRank?'':`<div class="${styles.playerRank}">#${i+1}</div>`}
            <div class="${styles.playerName}">${p.nama}</div>
            ${p.username?`<div class="${styles.playerUsername}">@${p.username}</div>`:''}
            ${p.kota?`<div class="${styles.playerCity}">${p.kota}</div>`:''}
          </div>
        </div>
        <div class="${styles.playerBody}">
          <span class="${styles.playerTier} ${tierClass}">${(p.tier||'RINTIS').toUpperCase()}</span>
          <span class="${styles.playerStars}">${bintang}</span>
          ${p.streak>0?`<span class="${styles.playerStreak}">🔥 ${p.streak} streak</span>`:''}
        </div>
        ${p.username?`<div class="${styles.sparringWrap}"><a href="/u/${p.username}" class="${styles.sparringButton}">🤝 Ajak Sparring</a></div>`:''}
      </div>`;
  };

  const renderBotMessage=(msg)=>{
    let html=msg.text;
    if(msg.data&&msg.data.length>0){ html+='<div class="player-cards">'; msg.data.forEach((p,i)=>{html+=buildCard(p,i);}); html+='</div>'; }
    if(msg.extra&&msg.extra.admin){
      html+=`<div class="${styles.adminSection}"><div class="${styles.adminHeading}">👑 Belum login? Ajak <strong>Admin</strong> sparring — aman tanpa login:</div>${buildCard(msg.extra.admin,0,true)}</div>`;
    }
    return <div dangerouslySetInnerHTML={{__html:html}}/>;
  };

  if(!isOpen) return <button className={styles.floatingButton} onClick={()=>setIsOpen(true)} aria-label="AI Assistant">💬</button>;

  return createPortal(
    <div className={styles.chatPopup}>
      {/* ===== HEADER ===== */}
      <div className={styles.chatHeader}>
        <span>AI Assistant</span>
        <button
          className={styles.closeBtn}
          onClick={() => setIsOpen(false)}
          aria-label="Tutup"
        >✕</button>
      </div>

      {/* ===== WATERMARK ===== */}
      <div className={styles.watermark}>billiard</div>

      {/* ===== MESSAGES ===== */}
      <div className={styles.chatMessages}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`${styles.message} ${msg.role === 'user' ? styles.user : styles.bot}`}
          >
            <div className={styles.messageBubble}>
              {msg.role === 'bot' ? renderBotMessage(msg) : msg.text}

              {msg.role === 'bot' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => sendFeedback(idx, 'helpful')}
                    disabled={!!msg.feedback}
                    style={{
                      padding: '2px 8px', fontSize: 12,
                      cursor: msg.feedback ? 'default' : 'pointer',
                      border: '1px solid ' + (msg.feedback === 'helpful' ? '#16a34a' : '#e5e5e5'),
                      borderRadius: 6,
                      background: msg.feedback === 'helpful' ? '#f0fdf4' : '#fff',
                      opacity: msg.feedback && msg.feedback !== 'helpful' ? 0.4 : 1,
                    }}
                  >👍</button>
                  <button
                    onClick={() => { setReasonIdx(idx); setReasonText(''); }}
                    disabled={!!msg.feedback}
                    style={{
                      padding: '2px 8px', fontSize: 12,
                      cursor: msg.feedback ? 'default' : 'pointer',
                      border: '1px solid ' + (msg.feedback === 'not_helpful' ? '#dc2626' : '#e5e5e5'),
                      borderRadius: 6,
                      background: msg.feedback === 'not_helpful' ? '#fef2f2' : '#fff',
                      opacity: msg.feedback && msg.feedback !== 'not_helpful' ? 0.4 : 1,
                    }}
                  >👎</button>
                </div>
              )}

              {msg.role === 'bot' && reasonIdx === idx && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <textarea
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    placeholder="Kenapa jawaban ini tidak membantu? (mis: nama salah, data tidak ada, dll)"
                    rows={2}
                    style={{
                      padding: '6px 10px', border: '1px solid #e5e5e5', borderRadius: 8,
                      fontSize: 12, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => { sendFeedback(idx, 'not_helpful', reasonText.trim() || null); setReasonIdx(null); setReasonText(''); }}
                      style={{ padding: '4px 12px', background: '#171717', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >Kirim</button>
                    <button
                      onClick={() => setReasonIdx(null)}
                      style={{ padding: '4px 12px', background: '#fff', color: '#525252', border: '1px solid #e5e5e5', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
                    >Batal</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className={`${styles.message} ${styles.bot}`}>
            <div className={styles.messageBubble}><span className={styles.typing}>...</span></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ===== QUICK REPLIES ===== */}
      <div className={styles.quickReplies}>
        {QUICK_REPLIES.map((q, i) => (
          <button
            key={i}
            className={styles.quickReplyBtn}
            onClick={() => sendMessage(q)}
            disabled={loading}
          >{q}</button>
        ))}
      </div>

      {/* ===== STATUS VOICE ===== */}
      {voice.status && (
        <div style={{
          textAlign: 'center',
          fontSize: 12,
          color: voice.status.includes('🙁') ? '#dc2626' : '#737373',
          padding: '4px 0 0',
        }}>
          {voice.status}
        </div>
      )}

      {/* ===== INPUT + MIC (PAKSA TAMPIL, INLINE STYLE + SVG) ===== */}
      <div className={styles.chatInputContainer}>
        <button
          onClick={voice.toggleMic}
          disabled={voice.processing || loading}
          aria-label="Input suara"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            border: '1px solid ' + (voice.listening ? '#dc2626' : '#e5e5e5'),
            background: voice.listening ? '#dc2626' : '#ffffff',
            color: voice.listening ? '#fff' : '#171717',
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          {voice.processing ? (
            <span style={{ fontSize: 16 }}>⏳</span>
          ) : voice.listening ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="5" width="14" height="14" rx="2"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="9" y="2" width="6" height="12" rx="3"/>
              <path d="M5 10v1a7 7 0 0 0 14 0v-1"/>
              <line x1="12" y1="18" x2="12" y2="22"/>
            </svg>
          )}
        </button>

        <input
          type="text"
          className={styles.chatInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Tulis pesan..."
          disabled={loading}
        />
        <button className={styles.sendButton} onClick={() => sendMessage()} disabled={loading}>↑</button>
      </div>
    </div>,
    document.body
  );
}