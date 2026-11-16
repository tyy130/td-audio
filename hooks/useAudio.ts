import { useState, useEffect, useRef, useCallback } from 'react';

// Mobile browsers suspend the page's AudioContext when the screen locks or
// the user leaves the browser. Any <audio> element routed through
// createMediaElementSource goes silent the moment that happens, so on
// touch devices the element must play straight to the output and the
// visualizer runs from the track's stored waveform peaks instead.
const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

export const useAudio = (src: string, onEnded?: () => void, shouldLoop = false, initialVolume = 1, peaks?: number[]) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const desiredPlayingRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  const currentSrcRef = useRef('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const peaksRef = useRef<number[] | undefined>(peaks);
  const graphAllowedRef = useRef<boolean | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(initialVolume);

  useEffect(() => {
    peaksRef.current = peaks;
  }, [peaks]);

  // Fill `out` with bar levels (0..1) for the visualizer. Called from the
  // visualizer's own animation loop so level changes never re-render React.
  const frequencyBufferRef = useRef<Uint8Array | null>(null);
  const readLevels = useCallback((out: number[]) => {
    const bars = out.length;
    const analyser = analyserRef.current;
    if (analyser) {
      let buffer = frequencyBufferRef.current;
      if (!buffer || buffer.length !== analyser.frequencyBinCount) {
        buffer = new Uint8Array(analyser.frequencyBinCount);
        frequencyBufferRef.current = buffer;
      }
      analyser.getByteFrequencyData(buffer);
      // Log-spaced bands from 40 Hz to 12 kHz, like hearing (and like a
      // studio meter). Even spacing piles all the music into the first few
      // bars and leaves the right side flat.
      const nyquist = (audioContextRef.current?.sampleRate ?? 44100) / 2;
      const binHz = nyquist / buffer.length;
      const lowHz = 40;
      const highHz = Math.min(12000, nyquist);
      for (let index = 0; index < bars; index += 1) {
        const f0 = lowHz * Math.pow(highHz / lowHz, index / bars);
        const f1 = lowHz * Math.pow(highHz / lowHz, (index + 1) / bars);
        const start = Math.min(buffer.length - 1, Math.floor(f0 / binHz));
        const end = Math.min(buffer.length, Math.max(start + 1, Math.ceil(f1 / binHz)));
        let peak = 0;
        for (let cursor = start; cursor < end; cursor += 1) {
          if (buffer[cursor] > peak) peak = buffer[cursor];
        }
        // Music has less energy up top; tilt so the highs still read.
        const tilt = 0.85 + 0.9 * (index / (bars - 1));
        out[index] = Math.max(0.06, Math.min(1, (peak / 255) * tilt));
      }
      return;
    }

    // No live analyser (touch devices): animate the bars from the track's
    // stored waveform peaks around the playhead instead.
    const audio = audioRef.current;
    const peaksData = peaksRef.current;
    if (!audio || !peaksData || peaksData.length === 0) {
      out.fill(0.08);
      return;
    }
    const progress =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.currentTime / audio.duration
        : 0;
    const center = Math.floor(progress * peaksData.length);
    const wobble = 0.85 + 0.15 * Math.sin(Date.now() / 280);
    for (let index = 0; index < bars; index += 1) {
      const peak =
        peaksData[Math.min(peaksData.length - 1, Math.max(0, center - 8 + index))] ?? 0.08;
      out[index] = Math.max(0.08, Math.min(1, peak * wobble));
    }
  }, []);

  const ensureAudioGraph = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return null;

    if (graphAllowedRef.current === null) {
      graphAllowedRef.current = !isTouchDevice();
    }
    if (!graphAllowedRef.current) {
      // Touch device: never capture the element into Web Audio, so the OS
      // keeps it playing in the background / on the lock screen.
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    if (!sourceNodeRef.current) {
      sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audio);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.78;
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -20;
      sourceNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (audioContextRef.current.state !== 'running') {
      console.warn('AudioContext not running; audio output may be silent', {
        state: audioContextRef.current.state,
      });
    }

    return analyserRef.current;
  }, []);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audio.muted = false;
    audio.volume = initialVolume;
    audio.loop = shouldLoop;
    audioRef.current = audio;

    const updateDuration = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const handleLoadedMetadata = () => {
      updateDuration();
      setCurrentTime(audio.currentTime);
    };

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(Number.isFinite(audio.duration) ? audio.duration : audio.currentTime);
      desiredPlayingRef.current = true;
      onEndedRef.current?.();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      sourceNodeRef.current?.disconnect();
      analyserRef.current?.disconnect();
      sourceNodeRef.current = null;
      analyserRef.current = null;
      audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.loop = shouldLoop;
  }, [shouldLoop]);

  useEffect(() => {
    setVolume(initialVolume);
  }, [initialVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!src) {
      desiredPlayingRef.current = false;
      currentSrcRef.current = '';
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      setIsPlaying(false);
      setDuration(0);
      setCurrentTime(0);
      return;
    }

    if (currentSrcRef.current === src) {
      return;
    }

    currentSrcRef.current = src;
    const shouldResumePlayback = desiredPlayingRef.current;

    audio.pause();
    audio.src = src;
    audio.load();
    setDuration(0);
    setCurrentTime(0);

    if (shouldResumePlayback) {
      ensureAudioGraph()?.then(() => audio.play()).catch((error) => {
        console.error('Auto-playback failed', error);
        desiredPlayingRef.current = false;
        setIsPlaying(false);
      });
    }
  }, [ensureAudioGraph, src]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const play = useCallback(() => {
    desiredPlayingRef.current = true;
    if (!audioRef.current || !currentSrcRef.current) return;
    // Tell iOS this is media playback (not incidental sound) so it keeps
    // playing through the lock screen and silent-mode switch.
    try {
      const nav = navigator as Navigator & {
        audioSession?: { type: string };
      };
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* Audio Session API not available — non-fatal */
    }
    ensureAudioGraph()?.then(() => audioRef.current?.play()).catch(error => {
      console.error('Playback failed', error);
      desiredPlayingRef.current = false;
      setIsPlaying(false);
    });
  }, [ensureAudioGraph]);

  const pause = useCallback(() => {
    desiredPlayingRef.current = false;
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const changeVolume = useCallback((vol: number) => {
    setVolume(vol);
  }, []);

  return {
    isPlaying,
    duration,
    currentTime,
    togglePlay,
    play,
    pause,
    seek,
    volume,
    changeVolume,
    readLevels,
  };
};
