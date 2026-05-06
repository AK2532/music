import { useCallback, useEffect, useRef } from 'react';
import { musicService } from '../services/api';
import { usePlayerStore } from '../stores/playerStore';

const analyserCache = new WeakMap();

export const audioMetrics = {
  bass: 0,
  mids: 0,
  treble: 0,
  raw: new Uint8Array(0)
};

export function getOrCreateAnalyser(audio) {
  if (!audio) return null;
  if (analyserCache.has(audio)) return analyserCache.get(audio);

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    const source = context.createMediaElementSource(audio);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    analyser.connect(context.destination);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const entry = {
      ctx: context,
      analyser,
      data,
    };
    analyserCache.set(audio, entry);
    
    audioMetrics.raw = data;

    const updateMetrics = () => {
      if (!audio.paused) {
        analyser.getByteFrequencyData(data);
        
        let bassSum = 0;
        for (let i = 0; i < 10; i++) bassSum += data[i];
        audioMetrics.bass = bassSum / 10 / 255;
        
        let midsSum = 0;
        for (let i = 10; i < 100; i++) midsSum += data[i];
        audioMetrics.mids = midsSum / 90 / 255;

        let trebleSum = 0;
        for (let i = 100; i < 200; i++) trebleSum += data[i];
        audioMetrics.treble = trebleSum / 100 / 255;
      } else {
        audioMetrics.bass *= 0.95;
        audioMetrics.mids *= 0.95;
        audioMetrics.treble *= 0.95;
      }
      requestAnimationFrame(updateMetrics);
    };
    updateMetrics();

    return entry;
  } catch (e) {
    console.warn("Analyser setup failed", e);
    return null;
  }
}

export function useAudioEngine() {
  const audioRef = useRef(null);
  const fadeRef = useRef(null);
  const fallbackTriedRef = useRef(false);
  const loadingTimeoutRef = useRef(null);
  const sponsorSegmentsRef = useRef([]);
  const isNewSongLoadingRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const stateRef = useRef({
    isPlaying: false,
    isMuted: false,
    volume: 0.82,
    crossfade: true,
    sponsorBlockEnabled: true,
    audioQuality: 'high',
  });

  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const volume = usePlayerStore((state) => state.volume);
  const isMuted = usePlayerStore((state) => state.isMuted);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const crossfade = usePlayerStore((state) => state.crossfade);
  const sponsorBlockEnabled = usePlayerStore((state) => state.sponsorBlockEnabled);
  const audioQuality = usePlayerStore((state) => state.audioQuality);
  const setCurrentTime = usePlayerStore((state) => state.setCurrentTime);
  const setDuration = usePlayerStore((state) => state.setDuration);
  const setPlaying = usePlayerStore((state) => state.setPlaying);
  const setLoading = usePlayerStore((state) => state.setLoading);
  const playNext = usePlayerStore((state) => state.playNext);

  if (audioRef.current == null) {
    const element = new Audio();
    element.preload = 'auto';
    element.crossOrigin = 'anonymous'; // Restored to securely allow the visualizer to read local backend streams
    audioRef.current = element;
  }

  useEffect(() => {
    stateRef.current = {
      isPlaying,
      isMuted,
      volume,
      crossfade,
      sponsorBlockEnabled,
      audioQuality,
    };
  }, [isPlaying, isMuted, volume, crossfade, sponsorBlockEnabled, audioQuality]);

  useEffect(() => {
    const unlockContext = () => {
      if (!audioRef.current) return;
      
      // AudioContext needs a user gesture to resume securely
      try {
        const entry = getOrCreateAnalyser(audioRef.current);
        if (entry?.ctx?.state === 'suspended') {
          entry.ctx.resume().catch(console.warn);
        }
      } catch (err) {
        console.warn('AudioContext init delayed until user interaction');
      }
    };

    window.addEventListener('click', unlockContext, { capture: true });
    window.addEventListener('touchstart', unlockContext, { capture: true });
    return () => {
      window.removeEventListener('click', unlockContext, { capture: true });
      window.removeEventListener('touchstart', unlockContext, { capture: true });
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!currentSong) return undefined;

    fallbackTriedRef.current = false;
    clearTimeout(loadingTimeoutRef.current);

    if (fadeRef.current) {
      clearInterval(fadeRef.current);
      fadeRef.current = null;
    }

    const doLoad = () => {
      setLoading(true);
      sponsorSegmentsRef.current = [];

      if (stateRef.current.sponsorBlockEnabled && currentSong?.id && window.__backendAvailable) {
        fetch(`https://sponsor.ajay.app/api/skipSegments?videoID=${currentSong.id}&categories=["sponsor","music_offtopic","interaction"]`)
          .then((response) => (response.ok ? response.json() : []))
          .then((data) => {
            if (Array.isArray(data)) sponsorSegmentsRef.current = data;
          })
          .catch(() => {});
      }

      isNewSongLoadingRef.current = true;
      const nextSrc = musicService.getStreamUrl(currentSong.id, stateRef.current.audioQuality);
      if (audio.src !== nextSrc) {
        audio.src = nextSrc;
        audio.load();


      }
      
      audio.volume = stateRef.current.isMuted ? 0 : stateRef.current.volume;

      loadingTimeoutRef.current = setTimeout(() => {
        if (!audio.duration) {
          setLoading(false);
          setPlaying(false);
          playNext();
        }
      }, 35000);

      if (stateRef.current.isPlaying) {
        audio.play().catch((err) => {
          if (err?.name !== 'AbortError') setPlaying(false);
        }).finally(() => {
          isNewSongLoadingRef.current = false;
        });
      } else {
        isNewSongLoadingRef.current = false;
      }
    };

    if (stateRef.current.crossfade && !audio.paused && audio.readyState >= 2) {
      let currentVolume = audio.volume;
      fadeRef.current = setInterval(() => {
        currentVolume = Math.max(0, currentVolume - 0.15);
        audio.volume = currentVolume;
        if (currentVolume <= 0) {
          clearInterval(fadeRef.current);
          fadeRef.current = null;
          doLoad();
        }
      }, 30);
    } else {
      doLoad();
    }

    return () => {
      if (fadeRef.current) clearInterval(fadeRef.current);
      clearTimeout(loadingTimeoutRef.current);
    };
  }, [currentSong, playNext, setLoading, setPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!currentSong) return;

    if (isPlaying) {
      try {
        const entry = getOrCreateAnalyser(audio);
        if (entry?.ctx?.state === 'suspended') {
          entry.ctx.resume().catch(() => {});
        }
      } catch (err) {}
      
      if (!isNewSongLoadingRef.current) {
        audio.play().catch((err) => {
          if (err?.name !== 'AbortError') setPlaying(false);
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, setPlaying]);

  useEffect(() => {
    // Separate effect for volume and mute to keep the main effect focused on source/playback transitions
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [isMuted, volume]);

  useEffect(() => {
    const audio = audioRef.current;

    const onTime = () => {
      const nextTime = audio.currentTime;
      setCurrentTime(nextTime);

      if (stateRef.current.sponsorBlockEnabled && sponsorSegmentsRef.current.length > 0) {
        for (const segment of sponsorSegmentsRef.current) {
          if (nextTime >= segment.segment[0] && nextTime < segment.segment[1]) {
            audio.currentTime = segment.segment[1];
            break;
          }
        }
      }

      const sleepTarget = usePlayerStore.getState().sleepTimer;
      if (sleepTarget && Date.now() > sleepTarget) {
        usePlayerStore.getState().setPlaying(false);
        usePlayerStore.getState().setSleepTimer(null);
      }
    };

    const onLoaded = () => {
      clearTimeout(loadingTimeoutRef.current);
      setDuration(audio.duration);
      setLoading(false);

      const targetVolume = stateRef.current.isMuted ? 0 : stateRef.current.volume;
      if (!stateRef.current.crossfade) {
        audio.volume = targetVolume;
        return;
      }

      audio.volume = 0;
      let currentVolume = 0;
      const fadeIn = setInterval(() => {
        currentVolume = Math.min(targetVolume, currentVolume + 0.08);
        audio.volume = currentVolume;
        if (currentVolume >= targetVolume) clearInterval(fadeIn);
      }, 30);
    };

    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onEnded = () => {
      consecutiveErrorsRef.current = 0; // Successful play — reset error counter
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        playNext();
      }
    };

    const onError = () => {
      clearTimeout(loadingTimeoutRef.current);
      setLoading(false);
      setPlaying(false);
      consecutiveErrorsRef.current += 1;

      if (consecutiveErrorsRef.current >= 3) {
        // Backend is likely down — stop auto-skipping to avoid an infinite refresh loop
        console.error('Multiple audio load failures. Stopping auto-skip to prevent refresh loop.');
        consecutiveErrorsRef.current = 0;
        return;
      }

      console.error('Audio failed to load. Skipping to next track in 2s.');
      setTimeout(() => playNext(), 2000);
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [currentSong, playNext, repeatMode, setCurrentTime, setDuration, setLoading, setPlaying]);

  const seek = useCallback((time) => {
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, [setCurrentTime]);

  return { audioRef, seek };
}
