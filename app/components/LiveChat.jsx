'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LiveChat({ initialMessages, onlineCount, username: propUsername }) {
  const [messages, setMessages] = useState(initialMessages || []);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const isLoggedIn = !!propUsername;

  const userPhotoMapRef = useRef({});
  const lastSentRef = useRef(0);

  const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  const getAvatarColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8A5C', '#A29BFE'];
    return colors[Math.abs(hash) % colors.length];
  };

  const formatRelativeTime = (dateStr) => {
    const dateUTC = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    const now = new Date();
    const diffMs = now - dateUTC;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin <= 0) return 'baru saja';
    if (diffMin < 60) return `${diffMin} mnt`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)} jam`;
    return `${Math.floor(diffMin / 1440)} hari`;
  };

  const fetchMessages = async () => {
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('id, username, message, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        setLoading(false);
        return;
      }

      if (!messagesData || messagesData.length === 0) {
        setMessages([]);
        setLoading(false);
        return;
      }

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('username, foto_url');

      if (usersError) {
        console.error('Error fetching users:', usersError);
      }

      const photoMap = {};
      if (usersData) {
        usersData.forEach((user) => {
          if (user.username) {
            photoMap[user.username.toLowerCase()] = user.foto_url;
          }
        });
      }
      userPhotoMapRef.current = photoMap;

      const formatted = messagesData.map((msg) => ({
        id: msg.id,
        user: msg.username,
        message: msg.message,
        waktu: formatRelativeTime(msg.created_at),
        foto_url: photoMap[msg.username?.toLowerCase()] || null,
      }));

      setMessages(formatted);
      setLoading(false);
    } catch (err) {
      console.error('Fetch error:', err);
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    const now = Date.now();
    if (now - lastSentRef.current < 1000) {
      alert('Tunggu 1 detik sebelum kirim pesan lagi');
      return;
    }
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) return;
    if (trimmedMessage.length > 500) {
      alert('Pesan maksimal 500 karakter');
      return;
    }
    if (!isLoggedIn) {
      alert('Silakan login terlebih dahulu');
      return;
    }
    lastSentRef.current = now;

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        username: propUsername,
        message: trimmedMessage,
      });

    if (error) {
      console.error('Error sending message:', error);
      alert('Gagal kirim pesan');
      return;
    }

    setNewMessage('');
  };

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel('chat_messages_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const newMsg = payload.new;
          const fotoUrl = userPhotoMapRef.current[newMsg.username?.toLowerCase()] || null;
          setMessages((prev) => [
            {
              id: newMsg.id,
              user: newMsg.username,
              message: newMsg.message,
              waktu: 'baru saja',
              foto_url: fotoUrl,
            },
            ...prev,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ border: '0.5px solid #e5e5e5', borderRadius: '4px', padding: '20px', textAlign: 'center', color: '#888' }}>
        Memuat chat...
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ border: '0.5px solid #e5e5e5', borderRadius: '4px', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: '#000', color: '#fff', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>💬</span>
            <span style={{ fontWeight: '600', fontSize: '12px' }}>Live Chat</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1D9E75', display: 'inline-block' }}></span>
            <span style={{ fontSize: '10px', color: '#aaa' }}>{onlineCount || 3} online</span>
          </div>
        </div>

        {/* Messages */}
        <div style={{ padding: '6px 12px', height: '400px', overflowY: 'auto', background: '#ffffff', boxSizing: 'border-box', display: 'flex', flexDirection: 'column-reverse' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#999', fontSize: '11px', padding: '20px 0' }}>
              Belum ada pesan. Jadilah yang pertama!
            </div>
          )}
          {messages.map((msg) => {
            const fotoUrl = msg.foto_url;
            const initials = getInitials(msg.user);
            const bgColor = getAvatarColor(msg.user);
            return (
              <div key={msg.id} style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>

                {/* FOTO → link ke /u/username */}
                <Link href={`/u/${msg.user}`} style={{ flexShrink: 0, textDecoration: 'none' }}>
                  {fotoUrl ? (
                    <img
                      src={fotoUrl}
                      alt={msg.user}
                      style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: '600' }}>
                      {initials}
                    </div>
                  )}
                </Link>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', flexWrap: 'wrap', flex: 1 }}>

                  {/* USERNAME → link ke /u/username */}
                  <Link href={`/u/${msg.user}`} style={{ textDecoration: 'none' }}>
                    <span style={{ fontWeight: '600', fontSize: '13px', color: '#000', whiteSpace: 'nowrap' }}>
                      {msg.user}
                    </span>
                  </Link>

                  <span style={{ fontSize: '9px', color: '#aaa' }}>{msg.waktu}</span>
                  <span style={{ fontSize: '13px', color: '#333', background: '#fff', padding: '2px 6px', borderRadius: '3px', border: '0.5px solid #e5e5e5', flex: '1', wordBreak: 'break-word' }}>
                    {msg.message}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div style={{ padding: '6px 12px', borderTop: '0.5px solid #e5e5e5', background: '#fff' }}>
          {isLoggedIn ? (
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="Ketik pesan..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
                style={{ flex: 1, padding: '4px 8px', border: '0.5px solid #e5e5e5', borderRadius: '3px', fontSize: '10px', outline: 'none', fontFamily: 'inherit' }}
              />
              <button
                onClick={sendMessage}
                style={{ padding: '4px 10px', background: '#000', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '10px', cursor: 'pointer', fontWeight: '500' }}
              >
                Kirim
              </button>
            </div>
          ) : (
            <Link href="/login" style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{ textAlign: 'center', padding: '6px', color: '#888', fontSize: '12px', border: '0.5px dashed #ccc', borderRadius: '3px', cursor: 'pointer' }}>
                🔒 Login untuk ikut chat
              </div>
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}