'use client';
import { useRef, useState, useEffect } from 'react';

// ===== KONFIGURASI =====
const WHISPER_MODEL = 'Xenova/whisper-small';
const SILENCE_MS    = 2000;  // diam 2 dtk -> auto stop+kirim
const MAX_MS        = 15000; // maks rekam 15 dtk
const NO_SPEECH_MS  = 8000;  // tanpa suara 8 dtk -> auto close
const RMS_THRESHOLD = 0.02;  // ambang suara

// ===== KAMUS KOREKSI DOMAIN (lokal) =====
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

function postProcessWhisper(raw) {
  let t = ' ' + raw.toLowerCase().replace(/[?.!,]/g, ' ') + ' ';
  for (const [re, rep] of FIX) t = t.replace(re, ' ' + rep + ' ');
  return t.replace(/\s+/g, ' ').trim();
}

// ===== LOAD WHISPER (sekali, di-cache) =====
let asr = null;
async function loadASR(onStatus) {
  if (asr) return asr;
  onStatus('Memuat model suara (sekali saja)...');
  const tf = await import(/* webpackIgnore:true */ 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
  asr = await tf.pipeline('automatic-speech-recognition', WHISPER_MODEL, { quantized: true });
  return asr;
}

// ===== DECODE + RESAMPLE 16kHz =====
async function decodeAndResample(blob) {
  const arr = await blob.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const dec = await ctx.decodeAudioData(arr);
  const data = dec.getChannelData(0);
  const ratio = dec.sampleRate / 16000;
  const len = Math.floor(data.length / ratio);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const s = Math.floor(i * ratio), e = Math.min(data.length, Math.floor((i + 1) * ratio));
    let sum = 0, c = 0;
    for (let j = s; j < e; j++) { sum += data[j]; c++; }
    out[i] = c ? sum / c : 0;
  }
  ctx.close();
  return out;
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
    setSupported(!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
  }, []);

  const flash = (msg) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 2500);
  };

  const process = async (blob, hasSpeech) => {
    if (!hasSpeech) return;
    setProcessing(true);
    setStatus('Mentranskrip...');
    try {
      const audio = await decodeAndResample(blob);
      const asrModel = await loadASR(setStatus);
      const out = await asrModel(audio, { language: 'id', task: 'transcribe' });
      const text = postProcessWhisper(out?.text || '');
      setProcessing(false);
      setStatus(null);
      if (text) onResultRef.current(text);
      else flash('Tidak terdengar jelas 🙁');
    } catch (e) {
      console.error('Voice error:', e);
      setProcessing(false);
      setStatus(null);
      flash('Gagal mentranskrip 🙁');
    }
  };

    const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { flash('Browser tidak mendukung voice 🙁'); return; }

    const recognition = new SR();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.continuous = false;      // 👈 auto-stop setelah diam, hemat memori
    recognition.maxAlternatives = 1;

    const state = { start: Date.now(), hasSpeech: false };
    let finalText = '';

    recognition.onstart = () => { setListening(true); setStatus('Mendengarkan...'); };

    recognition.onresult = (e) => {
      state.hasSpeech = true;
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
    };

    recognition.onerror = (e) => {
      if (e.error === 'not-allowed') flash('Izin mic ditolak 🙁');
      else if (e.error === 'no-speech') flash('Tidak terdengar apa-apa 🙁');
      else if (e.error !== 'aborted') flash('Error: ' + e.error);
    };

    recognition.onend = () => {          // 👈 dipanggil sekali, TIDAK restart
      setListening(false);
      const text = postProcess(finalText.trim());
      if (text) {
        setProcessing(true); setStatus('Mengirim...');
        setTimeout(() => { setProcessing(false); setStatus(null); onResultRef.current(text); }, 200);
      } else if (state.hasSpeech) flash('Tidak terdengar jelas 🙁');
      else setStatus(null);
    };

    // Pengaman: kalau 8 dtk tidak ada suara sama sekali, tutup
    const timer = setTimeout(() => {
      if (!state.hasSpeech) { try { recognition.stop(); } catch {} flash('Tidak terdengar apa-apa 🙁'); }
    }, 8000);

    try { recognition.start(); } catch { flash('Gagal memulai voice 🙁'); }

    stopRef.current = () => { clearTimeout(timer); try { recognition.stop(); } catch {} };
  };

  const toggleMic = async () => {
    if (processing) return;
    if (listening) { stopRef.current?.(); return; }
    if (!supported) {
      flash('Browser tidak mendukung mic 🙁');
      return;
    }
    try { await start(); }
    catch (e) { flash('Izin mic ditolak / tidak didukung 🙁'); }
  };

  return { supported, listening, processing, status, toggleMic };
}