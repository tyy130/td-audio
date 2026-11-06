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
  const animationFrameRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const peaksRef = useRef<number[] | undefined>(peaks);
  const graphAllowedRef = useRef<boolean | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(initialVolume);
  const [waveformData, setWaveformData] = useState<number[]>(() => Array.from({ length: 32 }, () => 0.08));

  useEffect(() => {
    peaksRef.current = peaks;
  }, [peaks]);

  const stopWaveformLoop = useCallback(() => {
    if (animationFrameRef.current != null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (fallbackTimerRef.current != null) {
      window.clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const resetWaveform = useCallback(() => {
    stopWaveformLoop();
    setWaveformData(Array.from({ length: 32 }, () => 0.08));
  }, [stopWaveformLoop]);

  const startWaveformLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) {
      // No live analyser (touch devices): animate the bars from the
      // track's stored waveform peaks around the playhead instead.
      stopWaveformLoop();
      const bars = 32;
      fallbackTimerRef.current = window.setInterval(() => {
        const audio = audioRef.current;
        const peaksData = peaksRef.current;
        if (!audio || !peaksData || peaksData.length === 0) return;
        const progress =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.currentTime / audio.duration
            : 0;
        const center = Math.floor(progress * peaksData.length);
        const wobble = 0.85 + 0.15 * Math.sin(Date.now() / 280);
        const nextBars = Array.from({ length: bars }, (_, index) => {
          const peak =
            peaksData[
              Math.min(peaksData.length - 1, Math.max(0, center - 8 + index))
            ] ?? 0.08;
          return Math.max(0.08, Math.min(1, peak * wobble));
        });
        setWaveformData(nextBars);
      }, 240);
      return;
    }

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const bars = 32;

    const tick = () => {
      analyser.getByteFrequencyData(buffer);
      const nextBars = Array.from({ length: bars }, (_, index) => {
        const start = Math.floor((index * buffer.length) / bars);
        const end = Math.floor(((index + 1) * buffer.length) / bars);
        let total = 0;
        let count = 0;

        for (let cursor = start; cursor < end; cursor += 1) {
          total += buffer[cursor];
          count += 1;
        }

        const magnitude = count > 0 ? total / count / 255 : 0;
        return Math.max(0.08, magnitude);
      });

      setWaveformData(nextBars);
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    stopWaveformLoop();
    tick();
  }, [stopWaveformLoop]);

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
      analyserRef.current.fftSize = 128;
      analyserRef.current.smoothingTimeConstant = 0.82;
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
    const handlePlay = () => {
      setIsPlaying(true);
      startWaveformLoop();
    };
    const handlePause = () => {
      setIsPlaying(false);
      stopWaveformLoop();
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(Number.isFinite(audio.duration) ? audio.duration : audio.currentTime);
      resetWaveform();
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
      stopWaveformLoop();
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
  }, [resetWaveform, startWaveformLoop, stopWaveformLoop]);

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
      resetWaveform();
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
    resetWaveform();

    if (shouldResumePlayback) {
      ensureAudioGraph()?.then(() => audio.play()).catch((error) => {
        console.error('Auto-playback failed', error);
        desiredPlayingRef.current = false;
        setIsPlaying(false);
      });
    }
  }, [ensureAudioGraph, resetWaveform, src]);

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
    waveformData
  };
};
