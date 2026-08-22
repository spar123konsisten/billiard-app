'use client';
import { useRef, useState, useEffect } from 'react';

// ===== KONFIGURASI =====
const WHISPER_MODEL = 'Xenova/whisper-small';
const SILENCE_MS = 2000;   // diam 2 dtk -> auto stop+kirim
const MAX_MS = 15000;  // maks rekam 15 dtk
const NO_SPEECH_MS = 8000;   // tanpa suara 8 dtk -> auto close
const RMS_THRESHOLD = 0.02;   // ambang suara (untuk Whisper)

// ===== DETEKSI ENGINE =====
function detectEngine() {
  if (typeof window === 'undefined') return 'none';
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const hasSpeechRecognition = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  if (isIOS && hasSpeechRecognition) return 'webspeech';
  if (navigator.mediaDevices?.getUserMedia && (window.AudioContext || window.webkitAudioContext)) return 'whisper';
  return 'none';
}

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

function fixText(raw) {
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
  tf.env.backends.onnx.wasm.numThreads = 4;
  asr = await tf.pipeline('automatic-speech-recognition', WHISPER_MODEL, {
    quantized: true,
    progress_callback: (data) => {
      if (data.status === 'progress') onStatus(`Mengunduh model suara: ${Math.round(data.progress ?? 0)}%`);
      else if (data.status === 'ready') onStatus(null);
    }
  });
  return asr;
}

// ===== DECODE + RESAMPLE 16kHz (untuk Whisper) =====
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
  const [engine, setEngine] = useState('none');
  const stopRef = useRef(null);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const eng = detectEngine();
      setEngine(eng);
      setSupported(eng !== 'none');
    }
  }, []);

  useEffect(() => { onResultRef.current = onResult; });

  // Matikan mic otomatis saat tab ke-background
  useEffect(() => {
    const onHide = () => { if (document.hidden) stopRef.current?.(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const flash = (msg) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 2500);
  };

  // ===== ENGINE 1: Web Speech API (iOS Safari & fallback) =====
  // ✅ DIPERBAIKI: pakai continuous=true + timer deteksi diam manual
  const startWebSpeech = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'id-ID';
    recognition.continuous = true;       // 👈 KUNCI: biar kita yang kontrol stop
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const state = { start: Date.now(), lastSound: Date.now(), hasSpeech: false };
    let finalText = '';

    recognition.onstart = () => { setListening(true); setStatus('Mendengarkan...'); };

    recognition.onresult = (e) => {
      state.hasSpeech = true;
      state.lastSound = Date.now();
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript + ' ';
        }
      }
    };

    recognition.onerror = (e) => {
      if (e.error === 'no-speech') flash('Tidak terdengar apa-apa 🙁');
      else if (e.error === 'not-allowed') flash('Izin mic ditolak 🙁');
      else if (e.error !== 'aborted') flash('Gagal mendengarkan 🙁');
    };

    recognition.onend = () => {
      setListening(false);
      setStatus(null);
      // ✅ Proses text SETELAH recognition selesai (pasti onresult sudah jalan)
      const text = fixText(finalText.trim());
      if (text) {
        setProcessing(true);
        setTimeout(() => {
          setProcessing(false);
          onResultRef.current(text);
        }, 200);
      } else if (state.hasSpeech) {
        flash('Tidak terdengar jelas 🙁');
      }
    };

    try { recognition.start(); } catch { flash('Gagal memulai voice 🙁'); return; }

    // ✅ Timer deteksi diam (auto stop + kirim)
    const timer = setInterval(() => {
      const elapsed = Date.now() - state.start;
      const silence = Date.now() - state.lastSound;

      if (!state.hasSpeech && elapsed > NO_SPEECH_MS) {
        clearInterval(timer);
        try { recognition.stop(); } catch { }
        flash('Tidak terdengar apa-apa 🙁');
      } else if ((state.hasSpeech && silence > SILENCE_MS) || elapsed > MAX_MS) {
        clearInterval(timer);
        try { recognition.stop(); } catch { }
      }
    }, 300);

    stopRef.current = () => {
      clearInterval(timer);
      try { recognition.stop(); } catch { }
    };
  };

  // ===== ENGINE 2: Whisper Lokal (non-iOS) =====
  const processPCM = async (audio, hasSpeech) => {
    if (!hasSpeech) return;
    setProcessing(true);
    setStatus('Mentranskrip...');
    try {
      const asrModel = await loadASR(setStatus);
      const out = await asrModel(audio, { language: 'id', task: 'transcribe' });
      const text = fixText(out?.text || '');
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

  const processBlob = async (blob, hasSpeech) => {
    if (!hasSpeech) return;
    try {
      const audio = await decodeAndResample(blob);
      await processPCM(audio, hasSpeech);
    } catch (e) {
      console.error('Voice error:', e);
      flash('Gagal mentranskrip 🙁');
    }
  };

  const startWhisper = async () => {
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

    const hasMediaRecorder = !!window.MediaRecorder;
    let recorder = null, chunks = [];
    let scriptProcessor = null, pcmChunks = [];
    const sampleRate = audioCtx.sampleRate;
    const state = { start: Date.now(), lastSound: Date.now(), hasSpeech: false };

    if (hasMediaRecorder) {
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        audioCtx.close();
        await processBlob(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }), state.hasSpeech);
      };
      recorder.start();
    } else {
      scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
      src.connect(scriptProcessor);
      scriptProcessor.connect(audioCtx.destination);
      scriptProcessor.onaudioprocess = (e) => pcmChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    }

    setListening(true);
    setStatus('Mendengarkan...');

    const stopFallback = async (shouldProcess) => {
      if (scriptProcessor) { scriptProcessor.disconnect(); src.disconnect(); }
      stream.getTracks().forEach(t => t.stop());
      audioCtx.close();
      if (shouldProcess && state.hasSpeech) {
        let totalLen = 0;
        for (const c of pcmChunks) totalLen += c.length;
        const merged = new Float32Array(totalLen);
        let offset = 0;
        for (const c of pcmChunks) { merged.set(c, offset); offset += c.length; }
        const ratio = sampleRate / 16000;
        const len = Math.floor(merged.length / ratio);
        const out = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          const s = Math.floor(i * ratio), e = Math.min(merged.length, Math.floor((i + 1) * ratio));
          let sum = 0, cnt = 0;
          for (let j = s; j < e; j++) { sum += merged[j]; cnt++; }
          out[i] = cnt ? sum / cnt : 0;
        }
        await processPCM(out, true);
      }
    };

    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const now = Date.now();
      if (rms > RMS_THRESHOLD) { state.hasSpeech = true; state.lastSound = now; }
      const elapsed = now - state.start;
      if (!state.hasSpeech && elapsed > NO_SPEECH_MS) {
        clearInterval(timer); setListening(false);
        hasMediaRecorder ? recorder.stop() : stopFallback(false);
        flash('Tidak terdengar apa-apa 🙁');
      } else if ((state.hasSpeech && (now - state.lastSound) > SILENCE_MS) || elapsed > MAX_MS) {
        clearInterval(timer); setListening(false);
        hasMediaRecorder ? recorder.stop() : stopFallback(true);
      }
    }, 200);

    stopRef.current = () => {
      clearInterval(timer); setListening(false);
      hasMediaRecorder ? recorder.stop() : stopFallback(true);
    };
  };

  // ===== TOGGLE MIC =====
  const toggleMic = async () => {
    if (processing) return;
    if (listening) { stopRef.current?.(); return; }
    if (!supported) {
      flash(window.isSecureContext === false
        ? 'Butuh HTTPS untuk mic 🙁'
        : 'Browser tidak mendukung mic 🙁');
      return;
    }
    try {
      if (engine === 'webspeech') {
        startWebSpeech();
      } else {
        await startWhisper();
      }
    } catch (e) {
      console.error('Error starting mic:', e);
      flash('Izin mic ditolak / tidak didukung 🙁');
    }
  };

  return { supported, listening, processing, status, toggleMic, engine };
}