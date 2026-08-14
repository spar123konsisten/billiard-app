'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './AiChat.module.css';

const QUICK_REPLIES = [
  'siapa peringkat 1?',
  'top 5 pemain',
  'siapa tier rintis?',
  'refresh data',
];

export default function AiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Halo! Saya asisten ranking.\n\nTanyakan tentang peringkat pemain, statistik, atau refresh data.\n\nTier: SURA → MAUNG → TUAH → AMOK → MENTENG → ISEN → RINTIS' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const message = text || input.trim();
    if (!message || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: message }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();

      if (data.success) {
        setMessages(prev => [...prev, { role: 'bot', text: data.message, data: data.data, type: data.type, extra: data.extra }]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', text: 'Maaf, terjadi kesalahan.' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Error: ' + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  const renderPlayerCard = (player, index) => {
    const tier = (player.tier || '').toLowerCase();
    const tierClass = styles[tier] || '';
    const bintang = '⭐'.repeat(player.bintang || 0) || '—';

    return (
      <div className={styles.playerCard} key={index}>
        <div className={styles.playerHeader}>
          <div className={styles.playerAvatar}>
            {player.foto_url ? (
              <img src={player.foto_url} alt={player.nama} />
            ) : (
              <span>{player.nama?.[0]?.toUpperCase() || '?'}</span>
            )}
          </div>
          <div className={styles.playerInfo}>
            <div className={styles.playerRank}>#{index + 1}</div>
            <div className={styles.playerName}>{player.nama}</div>
            {player.username && <div className={styles.playerUsername}>@{player.username}</div>}
            {player.kota && <div className={styles.playerCity}>{player.kota}</div>}
          </div>
        </div>
        <div className={styles.playerBody}>
          <span className={`${styles.playerTier} ${tierClass}`}>
            {(player.tier || 'RINTIS').toUpperCase()}
          </span>
          <span className={styles.playerStars}>{bintang}</span>
          {player.streak > 0 && (
            <span className={styles.playerStreak}>🔥 {player.streak} streak</span>
          )}
        </div>
      </div>
    );
  };

  const renderBotMessage = (msg) => {
    let html = msg.text;

    if (msg.data && msg.data.length > 0) {
      html += '<div class="player-cards">';
      msg.data.forEach((p, i) => {
        const tier = (p.tier || '').toLowerCase();
        const tierClass = styles[tier] || '';
        const bintang = '⭐'.repeat(p.bintang || 0) || '—';
        html += `
          <div class="${styles.playerCard}">
            <div class="${styles.playerHeader}">
              <div class="${styles.playerAvatar}">
                ${p.foto_url ? `<img src="${p.foto_url}" alt="${p.nama}" />` : `<span>${p.nama?.[0]?.toUpperCase() || '?'}</span>`}
              </div>
              <div class="${styles.playerInfo}">
                <div class="${styles.playerRank}">#${i + 1}</div>
                <div class="${styles.playerName}">${p.nama}</div>
                ${p.username ? `<div class="${styles.playerUsername}">@${p.username}</div>` : ''}
                ${p.kota ? `<div class="${styles.playerCity}">${p.kota}</div>` : ''}
              </div>
            </div>
            <div class="${styles.playerBody}">
              <span class="${styles.playerTier} ${tierClass}">${(p.tier || 'RINTIS').toUpperCase()}</span>
              <span class="${styles.playerStars}">${bintang}</span>
              ${p.streak > 0 ? `<span class="${styles.playerStreak}">🔥 ${p.streak} streak</span>` : ''}
            </div>
          </div>
        `;
      });
      html += '</div>';
    }

    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  if (!isOpen) {
    return (
      <button
        className={styles.floatingButton}
        onClick={() => setIsOpen(true)}
        aria-label="AI Assistant"
      >
        💬
      </button>
    );
  }

  return (
    <>
      <button
        className={styles.floatingButton}
        onClick={() => setIsOpen(false)}
        aria-label="Tutup"
      >
        ✕
      </button>
      <div className={styles.chatPopup}>
        <div className={styles.chatHeader}>
          <span>AI Assistant</span>
        </div>
        <div className={styles.chatMessages}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`${styles.message} ${msg.role === 'user' ? styles.user : styles.bot}`}
            >
              <div className={styles.messageBubble}>
                {msg.role === 'bot' ? renderBotMessage(msg) : msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className={`${styles.message} ${styles.bot}`}>
              <div className={styles.messageBubble}>
                <span className={styles.typing}>...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.quickReplies}>
          {QUICK_REPLIES.map((q, i) => (
            <button
              key={i}
              className={styles.quickReplyBtn}
              onClick={() => sendMessage(q)}
              disabled={loading}
            >
              {q}
            </button>
          ))}
        </div>

        <div className={styles.chatInputContainer}>
          <input
            type="text"
            className={styles.chatInput}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Tulis pesan..."
            disabled={loading}
          />
          <button
            className={styles.sendButton}
            onClick={() => sendMessage()}
            disabled={loading}
          >
            ↑
          </button>
        </div>
      </div>
    </>
  );
}