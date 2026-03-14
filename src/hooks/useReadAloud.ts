import { useState, useCallback, useRef, useEffect } from 'react';

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^[>\-*]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getPreferredVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();

  // Prefer natural/neural voices (much more human-sounding)
  // Microsoft Online voices (Edge) are neural TTS — best quality
  const msOnline = voices.find((v) => v.name.includes('Online') && v.name.includes('Natural') && v.lang.startsWith('en'));
  if (msOnline) return msOnline;

  // Microsoft Aria / Jenny / Guy Online — Edge neural voices
  const msNeural = voices.find((v) =>
    v.lang.startsWith('en') && v.name.includes('Online') && (
      v.name.includes('Aria') || v.name.includes('Jenny') || v.name.includes('Guy') ||
      v.name.includes('Ana') || v.name.includes('Andrew') || v.name.includes('Emma')
    )
  );
  if (msNeural) return msNeural;

  // Any Microsoft Online voice (neural)
  const msAnyOnline = voices.find((v) => v.name.includes('Online') && v.lang.startsWith('en'));
  if (msAnyOnline) return msAnyOnline;

  // Google voices (decent quality, available in Chrome)
  const google = voices.find((v) => v.name.includes('Google') && v.lang.startsWith('en'));
  if (google) return google;

  // Any Microsoft voice
  const ms = voices.find((v) => v.name.includes('Microsoft') && v.lang.startsWith('en'));
  if (ms) return ms;

  // Fallback to any English voice
  return voices.find((v) => v.lang.startsWith('en')) || null;
}

export function useReadAloud() {
  const [speaking, setSpeaking] = useState(false);
  const isReadingRef = useRef(false);

  // Load voices (some browsers load them async)
  useEffect(() => {
    speechSynthesis.getVoices();
    const handler = () => speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = handler;
    return () => { speechSynthesis.onvoiceschanged = null; };
  }, []);

  const speakInsight = useCallback((message: string) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(message);
    u.rate = 1.1;
    u.volume = 0.8;
    const voice = getPreferredVoice();
    if (voice) u.voice = voice;
    setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    speechSynthesis.speak(u);
  }, []);

  const speakAnswer = useCallback((text: string) => {
    speechSynthesis.cancel();

    const clean = stripMarkdown(text);
    const parts = clean.split(/\n\n+/).filter((p) => p.trim());
    if (parts.length === 0) return;

    isReadingRef.current = true;
    setSpeaking(true);

    let i = 0;
    function next() {
      if (i >= parts.length || !isReadingRef.current) {
        setSpeaking(false);
        isReadingRef.current = false;
        return;
      }
      const u = new SpeechSynthesisUtterance(parts[i]);
      u.rate = 1.0;
      u.volume = 1.0;
      const voice = getPreferredVoice();
      if (voice) u.voice = voice;
      u.onend = () => { i++; next(); };
      u.onerror = () => { i++; next(); };
      speechSynthesis.speak(u);
    }

    // Small delay to let any lingering insight speech finish
    setTimeout(next, 400);
  }, []);

  const stop = useCallback(() => {
    isReadingRef.current = false;
    speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { speaking, speakInsight, speakAnswer, stop };
}

export default useReadAloud;
