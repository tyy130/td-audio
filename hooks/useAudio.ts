import { useState, useEffect, useRef, useCallback } from 'react';

export const useAudio = (src: string, onEnded?: () => void, shouldLoop = false, initialVolume = 1) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(initialVolume);

  useEffect(() => {
    if (!src) {
      audioRef.current?.pause();
      audioRef.current = null;
      setIsPlaying(false);
      setDuration(0);
      setCurrentTime(0);
      return;
    }

    audioRef.current = new Audio(src);
    const audio = audioRef.current;
    audio.loop = shouldLoop;
    audio.volume = initialVolume;

    const setAudioData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
        setIsPlaying(false);
        if (onEnded) onEnded();
    };

    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
    };
    }, [src, onEnded, shouldLoop, initialVolume]);

  useEffect(() => {
      if(audioRef.current) {
          audioRef.current.volume = volume;
      }
  }, [volume]);

    useEffect(() => {
      if (audioRef.current) {
        audioRef.current.loop = shouldLoop;
      }
    }, [shouldLoop]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Playback failed", e));
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

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
    seek,
    volume,
    changeVolume
  };
};