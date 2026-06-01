import { useCallback, useEffect, useRef } from 'react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { musicService } from '../services/api';
import { usePlayerStore } from '../stores/playerStore';

const IS_NATIVE = Capacitor.isNativePlatform();

const analyserCache = new WeakMap();

export const audioMetrics = {
  bass: 0,
  mids: 0,
  treble: 0,
  raw: new Uint8Array(0)
};

export function getOrCreateAnalyser(audio) {
  // Bypassed: YouTube CDN URLs (googlevideo.com) are cross-origin and do not send CORS headers.
  // Connecting the audio element to Web Audio API via createMediaElementSource mutes/silences
  // the playback entirely due to browser security restrictions. Returning null here
  // allows the audio element to play natively through the system speakers with sound.
  return null;
}

export function useAudioEngine() {
  const audioRef = useRef(null);
  const fadeRef = useRef(null);
  const fallbackTriedRef = useRef(false);
  const loadingTimeoutRef = useRef(null);
  const sponsorSegmentsRef = useRef([]);
  const isNewSongLoadingRef = useRef(false);
  const loadAbortRef = useRef(null);   // AbortController for in-flight stream resolution
  const loadingSongIdRef = useRef(null); // Tracks which song triggered the current load
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
    // Do NOT set crossOrigin='anonymous' — audio.src is a direct CDN URL (googlevideo.com)
    // on both web and native. YouTube's CDN does not send CORS headers, so crossOrigin
    // would cause the browser to block playback. The visualizer's Web Audio API
    // will fail gracefully (already wrapped in try/catch) when the audio is cross-origin.
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

    // ── Abort any in-flight stream resolution for the PREVIOUS song ───────────
    if (loadAbortRef.current) {
      loadAbortRef.current.aborted = true; // Mark old controller as aborted
    }
    const abortController = { aborted: false };
    loadAbortRef.current = abortController;
    loadingSongIdRef.current = currentSong.id;

    fallbackTriedRef.current = false;
    clearTimeout(loadingTimeoutRef.current);

    if (fadeRef.current) {
      clearInterval(fadeRef.current);
      fadeRef.current = null;
    }

    const doLoad = () => {
      setLoading(true);
      sponsorSegmentsRef.current = [];

      if (stateRef.current.sponsorBlockEnabled && currentSong?.id) {
        if (IS_NATIVE) {
          // Native mobile: fetch directly from sponsor.ajay.app bypassing CORS
          const url = `https://sponsor.ajay.app/api/skipSegments?videoID=${currentSong.id}&categories=["sponsor","music_offtopic","interaction"]`;
          CapacitorHttp.request({ url, method: 'GET' })
            .then(res => {
              if (res.status === 200 && Array.isArray(res.data)) {
                sponsorSegmentsRef.current = res.data;
              }
            })
            .catch(() => {});
        } else if (window.__backendAvailable) {
          // Route through our Express proxy to avoid CORS — sponsor.ajay.app blocks direct browser requests
          fetch(`/api/skip-segments/${currentSong.id}`)
            .then((response) => (response.ok ? response.json() : []))
            .then((data) => {
              if (Array.isArray(data)) sponsorSegmentsRef.current = data;
            })
            .catch(() => {});
        }
      }

      isNewSongLoadingRef.current = true;
      const thisSongId = currentSong.id;
      const srcResult = musicService.getStreamUrl(thisSongId, stateRef.current.audioQuality);
      
      Promise.resolve(srcResult).then((nextSrc) => {
        // Guard: if this load was superseded by a newer song, discard the result
        if (abortController.aborted || loadingSongIdRef.current !== thisSongId) {
          console.log(`[AudioEngine] Discarding stale stream for ${thisSongId} (new song already loading)`);
          return;
        }

        if (!nextSrc) {
          console.error(`[AudioEngine] No stream URL returned for ${thisSongId}`);
          isNewSongLoadingRef.current = false;
          setLoading(false);
          setPlaying(false);
          return;
        }
        
        if (audio.src !== nextSrc) {
          audio.src = nextSrc;
          audio.load();
        }
        
        audio.volume = stateRef.current.isMuted ? 0 : stateRef.current.volume;

        if (stateRef.current.isPlaying) {
          audio.play().catch((err) => {
            if (err?.name !== 'AbortError') setPlaying(false);
          }).finally(() => {
            isNewSongLoadingRef.current = false;
          });
        } else {
          isNewSongLoadingRef.current = false;
        }
      }).catch((err) => {
        // Guard: don't act on stale resolutions
        if (abortController.aborted || loadingSongIdRef.current !== thisSongId) return;

        console.error("[AudioEngine] Stream resolution failed:", err);
        isNewSongLoadingRef.current = false;
        setLoading(false);
        setPlaying(false);
        // Do NOT auto-skip here — let the audio error handler deal with it
        // to avoid double-skipping if the audio element also fires an error event
      });

      // Safety timeout: only fire playNext if THIS exact song is still loading
      loadingTimeoutRef.current = setTimeout(() => {
        if (abortController.aborted || loadingSongIdRef.current !== thisSongId) return;
        if (!audio.duration) {
          console.warn(`[AudioEngine] Load timeout for ${thisSongId}. Stopping playback.`);
          setLoading(false);
          setPlaying(false);
        }
      }, 35000);
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
      // MEDIA_ERR_ABORTED (code 1) means the audio element was intentionally interrupted
      // because the src was changed to a new song. This is NOT a real error — ignore it.
      if (audio.error?.code === 1) {
        console.log('[AudioEngine] Audio source changed (MEDIA_ERR_ABORTED) — not a real error, ignoring.');
        return;
      }

      clearTimeout(loadingTimeoutRef.current);
      setLoading(false);
      setPlaying(false);
      consecutiveErrorsRef.current += 1;

      if (consecutiveErrorsRef.current >= 3) {
        console.error('Multiple audio load failures. Stopping playback to prevent a refresh loop.');
        consecutiveErrorsRef.current = 0;
        return;
      }

      console.error('Audio failed to load. Playback stopped on the selected track.');
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
