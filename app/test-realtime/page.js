'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestRealtimePage() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('Belum subscribe');

  useEffect(() => {
    const channel = supabase
      .channel('test-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pertandingan',
        },
        (payload) => {
          console.log('🔥 REALTIME EVENT:', payload);
          setEvents(prev => [payload, ...prev]);
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        setStatus(status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', fontFamily: 'sans-serif' }}>
      <h1>🧪 Test Supabase Realtime</h1>
      <p>Status: <strong>{status}</strong></p>
      <p style={{ color: '#888', fontSize: '14px' }}>
        Buka console (F12) untuk melihat log. Lalu di tab lain, ubah data di tabel pertandingan (insert/update/delete).
        Event akan muncul di bawah ini.
      </p>
      {events.length === 0 && <p style={{ color: '#999' }}>Belum ada event.</p>}
      {events.map((e, i) => (
        <div key={i} style={{ border: '1px solid #ddd', padding: '8px', marginBottom: '8px', borderRadius: '4px' }}>
          <strong>Event #{i+1}</strong>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>{JSON.stringify(e, null, 2)}</pre>
        </div>
      ))}
    </main>
  );
}