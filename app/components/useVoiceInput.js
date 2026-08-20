'use client';
import { useRef, useState, useEffect } from 'react';

// ===== KONFIGURASI =====
const SILENCE_MS    = 2000;   // diam 2 dtk -> auto stop+kirim
const MAX_MS        = 15000;  // maks rekam 15 dtk
const NO_SPEECH_MS  = 8000;   // tanpa suara 8 dtk -> auto close
const LANG          = 'id-ID';

// ===== KAMUS KOREKSI DOMAIN =====
const FIX = [
  [/\b(tiar|tir|tear|tierr)\b/g, 'tier'],
  [/\b(rin\s*tis|in\s*tis|rinti)\b/g, 'rintis'],
  [/\b(men\s*teng)\b/g, 'menteng'],
  [/\b(maong|moang)\b/g, 'maung'],
  [/\b(surah|shura)\b/g, 'sura'],
  [/\b(peringka|peringa)\b/g, 'peringkat'],
  [/\b(rekomend|rekomen)\b/g, 'rekomendasi'],
  [/\b(sparing|sparin)\b/g, 'sparring'],
  [/\b(jakartah)\b/g, 'jakarta'],
];

function postProcess(raw) {
  let t = ' ' + raw.toLowerCase().replace(/[?.!,]/g, ' ') + ' ';
  for (const [re, rep] of FIX) t = t.replace(re, ' ' + rep + ' ');
  return t.replace(/\s+/g, ' ').trim();
}

export function useVoiceInput({ onResult }) {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState(null);
  const [supported, setSupported] = useState(false);
  const stopRef = useRef(null);
  const onResultRef = useRef(onResult);

  useEffect(() => { onResultRef.current = onResult; });
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const flash = (msg) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 2500);
  };

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { flash('Browser tidak mendukung voice 🙁'); return; }

    const recognition = new SR();
    recognition.lang = LANG;
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    const state = { start: Date.now(), lastSound: Date.now(), hasSpeech: false };
    let finalText = '';

    recognition.onstart = () => {
      setListening(true);
      setStatus('Mendengarkan...');
    };

    recognition.onresult = (event) => {
      state.hasSpeech = true;
      state.lastSound = Date.now();
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + ' ';
        }
      }
    };

    recognition.onerror = (e) => {
      console.error('Speech error:', e.error);
      if (e.error === 'not-allowed') flash('Izin mic ditolak 🙁');
      else if (e.error === 'no-speech') flash('Tidak terdengar apa-apa 🙁');
      else flash('Error: ' + e.error);
    };

    recognition.onend = () => {
      setListening(false);
      setProcessing(true);
      setStatus('Mentranskrip...');
      const text = postProcess(finalText.trim());
      setTimeout(() => {
        setProcessing(false);
        setStatus(null);
        if (text) onResultRef.current(text);
        else if (state.hasSpeech) flash('Tidak terdengar jelas 🙁');
      }, 300);
    };

    // Timer deteksi diam (auto stop + kirim)
    const timer = setInterval(() => {
      const elapsed = Date.now() - state.start;
      const silence = Date.now() - state.lastSound;

      if (!state.hasSpeech && elapsed > NO_SPEECH_MS) {
        clearInterval(timer);
        recognition.stop();
        flash('Tidak terdengar apa-apa 🙁');
      } else if (state.hasSpeech && silence > SILENCE_MS) {
        clearInterval(timer);
        recognition.stop();
      } else if (elapsed > MAX_MS) {
        clearInterval(timer);
        recognition.stop();
      }
    }, 300);

    recognition.start();
    stopRef.current = () => {
      clearInterval(timer);
      recognition.stop();
    };
  };

  const toggleMic = async () => {
    if (processing) return;
    if (listening) { stopRef.current?.(); return; }
    try { start(); }
    catch (e) { flash('Gagal memulai voice 🙁'); }
  };

  return { supported, listening, processing, status, toggleMic };
}