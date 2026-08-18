'use client';
import { useRef, useState, useEffect } from 'react';

// ===== KONFIGURASI =====
const WHISPER_MODEL = 'Xenova/whisper-medium'; // akurasi jauh lebih baik, tetap lokalconst SILENCE_MS    = 2000;  // diam 2 dtk -> auto stop+kirim
const MAX_MS        = 15000; // maks rekam
const NO_SPEECH_MS  = 8000;  // tanpa suara -> auto close
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
      setProcessing(false);
      setStatus(null);
      flash('Gagal mentranskrip 🙁');
    }
  };

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
});
    const AC = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AC();
    const src = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    const recorder = new MediaRecorder(stream);
    const chunks = [];
    const state = { start: Date.now(), lastSound: Date.now(), hasSpeech: false };

    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      audioCtx.close();
      await process(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }), state.hasSpeech);
    };

    recorder.start();
    setListening(true);
    setStatus('Mendengarkan...');

    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const now = Date.now();
      if (rms > RMS_THRESHOLD) {
        state.hasSpeech = true;
        state.lastSound = now;
      }
      const elapsed = now - state.start;

      if (!state.hasSpeech && elapsed > NO_SPEECH_MS) {
        clearInterval(timer);
        setListening(false);
        recorder.stop();
        flash('Tidak terdengar apa-apa 🙁');
      } else if ((state.hasSpeech && (now - state.lastSound) > SILENCE_MS) || elapsed > MAX_MS) {
        clearInterval(timer);
        setListening(false);
        recorder.stop();
      }
    }, 200);

    stopRef.current = () => {
      clearInterval(timer);
      setListening(false);
      recorder.stop();
    };
  };

  const toggleMic = async () => {
    if (processing) return;
    if (listening) { stopRef.current?.(); return; }
    try { await start(); }
    catch (e) { flash('Izin mic ditolak / tidak didukung 🙁'); }
  };

  return { supported, listening, processing, status, toggleMic };
}