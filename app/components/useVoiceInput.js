'use client';
import { useRef, useState, useEffect } from 'react';

// ===== KONFIGURASI =====
const MODEL_MOBILE = 'Xenova/whisper-small';
const MODEL_DESKTOP = 'Xenova/whisper-small';
const SILENCE_MS = 2000;  // diam 2 dtk -> auto stop+kirim
const MAX_MS = 15000; // maks rekam 15 dtk
const NO_SPEECH_MS = 8000;  // tanpa suara 8 dtk -> auto close
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

  // Deteksi perangkat
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const modelName = isMobile ? MODEL_MOBILE : MODEL_DESKTOP;

  onStatus('Menghubungkan asisten suara...');
  const tf = await import(/* webpackIgnore:true */ 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');

  // Konfigurasi thread WASM demi keamanan RAM di HP
  tf.env.backends.onnx.wasm.proxy = true; // Jalankan AI di Web Worker agar thread utama tidak beku (mencegah Safari refresh paksa)
  if (isMobile) {
    tf.env.backends.onnx.wasm.numThreads = 1; // 1 thread di HP (sangat hemat RAM, bebas crash)
  } else {
    tf.env.backends.onnx.wasm.numThreads = 4; // 4 thread di Laptop (kecepatan maksimal)
  }

  asr = await tf.pipeline('automatic-speech-recognition', modelName, {
    quantized: true,
    progress_callback: (data) => {
      if (data.status === 'progress') {
        onStatus(`Mengunduh asisten suara: ${Math.round(data.progress)}%`);
      } else if (data.status === 'ready') {
        onStatus('Menyiapkan model...');
      }
    }
  });
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isSupported = !!(
        navigator.mediaDevices?.getUserMedia &&
        (window.AudioContext || window.webkitAudioContext)
      );
      setSupported(isSupported);
    }
  }, []);

  useEffect(() => { onResultRef.current = onResult; });
  // Kalau tab pindah/background (HP lock, ganti app), matikan mic biar tidak di-kill browser
  useEffect(() => {
    const onHide = () => { if (document.hidden) stopRef.current?.(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const flash = (msg) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 2500);
  };

  const processPCM = async (audio, hasSpeech) => {
    if (!hasSpeech) return;
    setProcessing(true);
    setStatus('Mentranskrip...');
    try {
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

  const process = async (blob, hasSpeech) => {
    if (!hasSpeech) return;
    try {
      const audio = await decodeAndResample(blob);
      await processPCM(audio, hasSpeech);
    } catch (e) {
      console.error('Voice error:', e);
      flash('Gagal mentranskrip 🙁');
    }
  };

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const AC = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AC();
    const src = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    const hasMediaRecorder = typeof window !== 'undefined' && !!window.MediaRecorder;
    let recorder = null;
    let chunks = [];
    let scriptProcessor = null;
    let pcmChunks = [];
    const sampleRate = audioCtx.sampleRate;

    const state = { start: Date.now(), lastSound: Date.now(), hasSpeech: false };

    if (hasMediaRecorder) {
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        audioCtx.close();
        await process(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }), state.hasSpeech);
      };
      recorder.start();
    } else {
      scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
      src.connect(scriptProcessor);
      scriptProcessor.connect(audioCtx.destination);
      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        pcmChunks.push(new Float32Array(inputData));
      };
    }

    setListening(true);
    setStatus('Mendengarkan...');

    const stopFallback = async (shouldProcess) => {
      if (scriptProcessor) {
        scriptProcessor.disconnect();
        src.disconnect();
      }
      stream.getTracks().forEach(t => t.stop());
      audioCtx.close();

      if (shouldProcess && state.hasSpeech) {
        let totalLength = 0;
        for (const chunk of pcmChunks) totalLength += chunk.length;
        const mergedPcm = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of pcmChunks) {
          mergedPcm.set(chunk, offset);
          offset += chunk.length;
        }

        // Resample to 16kHz
        const ratio = sampleRate / 16000;
        const len = Math.floor(mergedPcm.length / ratio);
        const out = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          const s = Math.floor(i * ratio), e = Math.min(mergedPcm.length, Math.floor((i + 1) * ratio));
          let sum = 0, c = 0;
          for (let j = s; j < e; j++) { sum += mergedPcm[j]; c++; }
          out[i] = c ? sum / c : 0;
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
      if (rms > RMS_THRESHOLD) {
        state.hasSpeech = true;
        state.lastSound = now;
      }
      const elapsed = now - state.start;

      if (!state.hasSpeech && elapsed > NO_SPEECH_MS) {
        clearInterval(timer);
        setListening(false);
        if (hasMediaRecorder) {
          recorder.stop();
        } else {
          stopFallback(false);
        }
        flash('Tidak terdengar apa-apa 🙁');
      } else if ((state.hasSpeech && (now - state.lastSound) > SILENCE_MS) || elapsed > MAX_MS) {
        clearInterval(timer);
        setListening(false);
        if (hasMediaRecorder) {
          recorder.stop();
        } else {
          stopFallback(true);
        }
      }
    }, 200);

    stopRef.current = () => {
      clearInterval(timer);
      setListening(false);
      if (hasMediaRecorder) {
        recorder.stop();
      } else {
        stopFallback(true);
      }
    };
  };

  const toggleMic = async () => {
    if (processing) return;
    if (listening) { stopRef.current?.(); return; }
    if (!supported) {
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        flash('Butuh koneksi aman (HTTPS) untuk mic 🙁');
      } else {
        flash('Browser tidak mendukung mic 🙁');
      }
      return;
    }
    try { await start(); }
    catch (e) {
      console.error('Error starting mic:', e);
      flash('Izin mic ditolak / tidak didukung 🙁');
    }
  };

  return { supported, listening, processing, status, toggleMic };
}