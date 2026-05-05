import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { musicService } from '../services/api';

// ─── Mood params (SimpMusic HOME_PARAMS_*) ────────────────────────────────────
export const MOOD_PARAMS = [
  { key: 'default',   label: 'For You'   },
  { key: 'relax',     label: 'Relax'     },
  { key: 'energize',  label: 'Energize'  },
  { key: 'focus',     label: 'Focus'     },
  { key: 'workout',   label: 'Workout'   },
  { key: 'feel_good', label: 'Feel Good' },
  { key: 'romance',   label: 'Romance'   },
  { key: 'sad',       label: 'Melancholy'},
  { key: 'party',     label: 'Party'     },
  { key: 'commute',   label: 'Commute'   },
  { key: 'sleep',     label: 'Sleep'     },
];

// ─── Weighted shuffle (history-aware, like SimpMusic's queue algo) ────────────
function weightedShuffle(songs, history = [], currentId = null) {
  const recentWindow = Math.max(1, Math.floor(songs.length * 0.4));
  const recentIds = new Set(history.slice(-recentWindow).map(s => s.id));
  const pool = songs
    .filter(s => s.id !== currentId)
    .map(s => ({ song: s, weight: recentIds.has(s.id) ? 0.2 : 1 }));

  const result = [];
  while (pool.length > 0) {
    const total = pool.reduce((sum, e) => sum + e.weight, 0);
    let cursor = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i++) {
      cursor -= pool[i].weight;
      if (cursor <= 0) { idx = i; break; }
    }
    result.push(pool[idx].song);
    pool.splice(idx, 1);
  }
  return result;
}

function uniqById(items) {
  return Array.from(new Map(items.filter(Boolean).map(s => [s.id, s])).values());
}

// ─── Stage 2 & 3: Ranking & Filtering (The "Taste Engine") ──────────────
function rankCandidates(candidates, currentSong, history, likedIds, playCounts, activeMood) {
  if (!candidates.length) return [];
  
  const historyArray = Array.isArray(history) ? history : [];
  const recentIds = new Set(historyArray.slice(-15).map(s => s.id));
  const playedIds = new Set(historyArray.map(s => s.id));
  const artistCounts = historyArray.reduce((acc, s) => { acc[s.artist] = (acc[s.artist] || 0) + 1; return acc; }, {});

  // Stage 2: Multi-Factor Scoring (Simplified DNN simulation)
  const scored = candidates.map(track => {
    let score = 100; // Base score

    // Signal 1: Explicit User Preference (Liked Affinity)
    if (likedIds.has(track.id)) score += 300;

    // Signal 2: Content Similarity (Artist Continuity)
    if (currentSong && track.artist === currentSong.artist) score += 150;

    // Signal 3: Historical Profile (User Taste)
    const playFreq = playCounts[track.id] || 0;
    if (playFreq > 0) score += Math.min(playFreq * 20, 100);
    
    const artistAffinity = artistCounts[track.artist] || 0;
    if (artistAffinity > 0) score += Math.min(artistAffinity * 15, 120);

    // Signal 4: Discovery Signal (New content boost)
    if (!playedIds.has(track.id)) score += 80;

    // Signal 5: Mood Context (Mood overlap)
    // (If track metadata includes tags, we would match against activeMood)

    // Stage 3: Filtering & Re-ranking (Diversity & Freshness)
    
    // Freshness Penalty: Avoid repeating things we JUST heard
    if (recentIds.has(track.id)) score -= 250;

    // Diversity Penalty: Discourage too many consecutive songs by same artist
    const lastArtist = historyArray[historyArray.length - 1]?.artist;
    if (track.artist === lastArtist) score -= 80;

    // Add controlled randomness for "Exploration" vs "Exploitation"
    score *= (0.85 + Math.random() * 0.3);

    return { track, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map(item => item.track);
}

function getActiveQueue(state) {
  return state.isShuffled ? state.shuffledQueue : state.queue;
}

function syncInsertedSong(list, song, index = list.length) {
  const next = [...list];
  next.splice(Math.max(0, index), 0, song);
  return next;
}

function syncRemovedSong(list, id) {
  return list.filter(s => s.id !== id);
}

export const usePlayerStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        queue: [],
        originalQueue: [],
        shuffledQueue: [],
        currentIndex: -1,
        currentSong: null,

        isPlaying: false,
        isShuffled: false,
        repeatMode: 'none',
        radioMode: false,
        crossfade: true,
        sponsorBlockEnabled: false,
        lyricsProvider: 'lrclib',
        audioQuality: 'high',

        volume: 0.82,
        isMuted: false,
        duration: 0,
        currentTime: 0,
        isLoading: false,
        buffered: 0,
        sleepTimer: null,

        // SimpMusic: activeMood for home page
        activeMood: 'default',

        // Playlist picker state
        isPlaylistPickerOpen: false,
        songToAddToPlaylist: null,

        // Download picker state
        isDownloadPickerOpen: false,
        songToDownload: null,

        openDownloadPicker: (song) => set({ isDownloadPickerOpen: true, songToDownload: song }),
        closeDownloadPicker: () => set({ isDownloadPickerOpen: false, songToDownload: null }),

        playHistory: [],
        playCounts: {},
        likedIds: new Set(),
        playlists: [],
        downloads: [],

        // ── Core queue management ─────────────────────────────────────────────

        loadQueueAndPlay: (songs, startSong, forceRadio = true) => {
          if (!startSong) return;
          const queue = songs?.length ? songs : [startSong];
          const idx = queue.findIndex(s => s.id === startSong.id);
          const nextIndex = idx >= 0 ? idx : 0;
          const nextState = { 
            queue, 
            originalQueue: queue, 
            shuffledQueue: [], 
            currentIndex: nextIndex, 
            currentSong: queue[nextIndex] ?? startSong, 
            isPlaying: true, 
            currentTime: 0, 
            radioMode: forceRadio 
          };
          set(nextState);
          get()._addToHistory(nextState.currentSong);
          // SimpMusic: fetch related only if radio mode is active
          if (forceRadio) get()._fetchAndAppendRelated(nextState.currentSong, queue);
        },

        // ── YouTube Music-style Algorithmic Play ──────────────────────────────
        // The KEY difference: When playing from search/discovery, DON'T use
        // search results as queue. Instead, play the song immediately and build
        // the queue from YouTube Music's recommendation algorithm.
        playWithAlgorithm: (song) => {
          if (!song) return;

          // 1. Play the song IMMEDIATELY with a queue of just this song
          set({
            queue: [song],
            originalQueue: [song],
            shuffledQueue: [],
            currentIndex: 0,
            currentSong: song,
            isPlaying: true,
            currentTime: 0,
            radioMode: true, // Auto-enable radio for infinite continuation
          });
          get()._addToHistory(song);

          // 2. In the background, fetch the ALGORITHMIC queue from YouTube Music
          (async () => {
            try {
              const watchPlaylist = await musicService.getWatchPlaylist(song.id);
              if (!watchPlaylist?.length) {
                // Fallback to related if watch-playlist fails
                const related = await musicService.getRelated(song.id);
                if (related?.length) {
                  const state = get();
                  const ranked = rankCandidates(related, song, state.playHistory, state.likedIds, state.playCounts, state.activeMood);
                  set(s => ({
                    queue: uniqById([song, ...ranked]),
                    originalQueue: uniqById([song, ...ranked]),
                  }));
                }
                return;
              }

              // 3. Rank through the Taste Engine
              const state = get();
              const ranked = rankCandidates(
                watchPlaylist,
                song,
                state.playHistory,
                state.likedIds,
                state.playCounts,
                state.activeMood
              );

              // 4. Silently replace the queue (keep current song at index 0)
              const newQueue = uniqById([song, ...ranked]);
              set(s => ({
                queue: newQueue,
                originalQueue: newQueue,
                shuffledQueue: s.isShuffled ? weightedShuffle(newQueue, s.playHistory, song.id) : [],
              }));
            } catch (err) {
              console.warn('[Algo] Watch playlist fetch failed:', err);
            }
          })();
        },

        // SimpMusic Best: Infinite Radio Algorithm
        // Periodically check if we need more songs in the queue
        _maintainRadioQueue: async () => {
          const state = get();
          if (!state.radioMode || !state.currentSong) return;
          
          const active = getActiveQueue(state);
          const remaining = active.length - state.currentIndex;
          
          // If less than 5 songs left, fetch more
          if (remaining < 5) {
            await get()._fetchAndAppendRelated(state.currentSong, state.queue);
          }
        },

        playSongAt: (song) => {
          const active = getActiveQueue(get());
          const idx = active.findIndex(s => s.id === song.id);
          if (idx < 0) return;
          set({ currentIndex: idx, currentSong: active[idx], isPlaying: true, currentTime: 0 });
          get()._addToHistory(active[idx]);
        },

        // ── playNext – SimpMusic algorithm ────────────────────────────────────
        // 1. Repeat one → restart
        // 2. If radioMode and near end → fetch related from API (User Taste)
        // 3. Advance in queue normally
        // 4. Repeat all → wrap around
        playNext: () => {
          const state = get();
          const active = getActiveQueue(state);

          if (state.repeatMode === 'one') {
            set({ currentTime: 0, isPlaying: true });
            return;
          }

          const nearEnd = state.currentIndex >= active.length - 3;

          if (state.radioMode && nearEnd) {
            // Try to extend queue via API first
            get()._maintainRadioQueue();
          }

          if (state.currentIndex < active.length - 1) {
            const next = active[state.currentIndex + 1];
            set({ currentIndex: state.currentIndex + 1, currentSong: next, isPlaying: true, currentTime: 0 });
            get()._addToHistory(next);
            return;
          }

          if (state.repeatMode === 'all' && active.length > 0) {
            const next = active[0];
            set({ currentIndex: 0, currentSong: next, isPlaying: true, currentTime: 0 });
            get()._addToHistory(next);
            return;
          }

          // SimpMusic Logic: If radioMode is ON, trigger "Infinite Automix"
          if (!state.radioMode) {
            set({ isPlaying: false });
            return;
          }

          const startAutomix = async () => {
            const ranked = rankCandidates(state.queue, state.currentSong, state.playHistory, state.likedIds, state.playCounts, state.activeMood);
            // Try to find something in the current list we haven't heard recently
            let next = ranked.find(s => s.id !== state.currentSong?.id);
            
            // If no local candidates (or we are at the end of a small playlist), force-fetch from YouTube Music
            if (!next || state.queue.length < 5) {
              await get()._fetchAndAppendRelated(state.currentSong, state.queue);
              const updatedState = get();
              const updatedRanked = rankCandidates(updatedState.queue, updatedState.currentSong, updatedState.playHistory, updatedState.likedIds, updatedState.playCounts, updatedState.activeMood);
              // Filter out songs we just played to ensure "random/new" music
              const recentIds = new Set(state.playHistory.slice(-10).map(s => s.id));
              next = updatedRanked.find(s => s.id !== state.currentSong?.id && !recentIds.has(s.id));
            }

            if (next) {
              if (!state.radioMode) set({ radioMode: true });
              const queue = uniqById([...get().queue, next]);
              const shuffledQueue = state.isShuffled ? uniqById([...get().shuffledQueue, next]) : get().shuffledQueue;
              const currentIndex = state.isShuffled ? shuffledQueue.length - 1 : queue.length - 1;
              set({ queue, originalQueue: queue, shuffledQueue, currentIndex, currentSong: next, isPlaying: true, currentTime: 0 });
              get()._addToHistory(next);
            } else {
              set({ isPlaying: false });
            }
          };

          startAutomix();
        },

        // ── SimpMusic: auto-fetch related and append to queue ─────────────────
        // Enhanced with "Taste Algorithm": Scores tracks by history and likes
        _fetchAndAppendRelated: async (song, currentQueue) => {
          if (!song?.id) return;
          try {
            const related = await musicService.getRelated(song.id);
            if (!related?.length) return;

            const state = get();
            const existingIds = new Set(currentQueue.map(s => s.id));
            const candidateTracks = related.filter(t => !existingIds.has(t.id));
            if (!candidateTracks.length) return;

            // Stage 2 & 3: Ranking & Filtering via Taste Engine
            const rankedTracks = rankCandidates(
              candidateTracks, 
              song, 
              state.playHistory, 
              state.likedIds, 
              state.playCounts, 
              state.activeMood
            );

            set(state => {
              const queue = uniqById([...state.queue, ...rankedTracks]);
              const shuffledQueue = state.isShuffled ? uniqById([...state.shuffledQueue, ...rankedTracks]) : state.shuffledQueue;
              return { queue, originalQueue: queue, shuffledQueue };
            });
          } catch (_) {}
        },

        playPrev: () => {
          const state = get();
          if (state.currentTime > 3) { set({ currentTime: 0 }); return; }
          const active = getActiveQueue(state);
          if (state.currentIndex <= 0) { set({ currentTime: 0 }); return; }
          const prev = active[state.currentIndex - 1];
          set({ currentIndex: state.currentIndex - 1, currentSong: prev, isPlaying: true, currentTime: 0 });
          get()._addToHistory(prev);
        },

        togglePlay: () => set(state => ({ isPlaying: state.currentSong ? !state.isPlaying : state.isPlaying })),
        setPlaying: (v) => set({ isPlaying: v }),
        setLoading: (v) => set({ isLoading: v }),
        setBuffered: (v) => set({ buffered: v }),

        // SimpMusic weighted shuffle
        toggleShuffle: () => {
          const state = get();
          if (!state.queue.length) return;
          if (!state.isShuffled) {
            const shuffled = weightedShuffle(state.queue, state.playHistory, state.currentSong?.id);
            if (state.currentSong) shuffled.unshift(state.currentSong);
            set({ isShuffled: true, shuffledQueue: shuffled, currentIndex: 0 });
            return;
          }
          const idx = state.queue.findIndex(s => s.id === state.currentSong?.id);
          set({ isShuffled: false, currentIndex: idx >= 0 ? idx : 0 });
        },

        cycleRepeat: () => {
          const modes = ['none', 'all', 'one'];
          set(state => ({ repeatMode: modes[(modes.indexOf(state.repeatMode) + 1) % modes.length] }));
        },

        toggleRadioMode: () => {
          const state = get();
          const next = !state.radioMode;
          set({ radioMode: next });
          // SimpMusic: when enabling radio, immediately load related tracks
          if (next && state.currentSong) get()._fetchAndAppendRelated(state.currentSong, state.queue);
        },

        setActiveMood: (mood) => set({ activeMood: mood }),

        setCrossfade: (v) => set({ crossfade: Boolean(v) }),
        setSponsorBlockEnabled: (v) => set({ sponsorBlockEnabled: Boolean(v) }),
        setLyricsProvider: (v) => set({ lyricsProvider: v || 'auto' }),
        setAudioQuality: (v) => set({ audioQuality: v || 'high' }),

        setVolume: (v) => set({ volume: v, isMuted: v === 0 }),
        toggleMute: () => set(state => ({ isMuted: !state.isMuted })),
        setCurrentTime: (v) => set({ currentTime: v }),
        setDuration: (v) => set({ duration: Number.isFinite(v) ? v : 0 }),

        seek: (percent) => {
          const duration = get().duration;
          const t = Math.max(0, Math.min(1, percent)) * duration;
          set({ currentTime: t });
          return t;
        },

        setSleepTimer: (minutes) => {
          if (minutes === null) { set({ sleepTimer: null }); return; }
          set({ sleepTimer: Date.now() + minutes * 60000 });
        },

        addToQueueNext: (song) => set(state => {
          const at = Math.max(0, state.currentIndex + 1);
          const queue = syncInsertedSong(state.queue, song, state.isShuffled ? Math.max(0, state.queue.findIndex(e => e.id === state.currentSong?.id) + 1) : at);
          const shuffledQueue = state.isShuffled ? syncInsertedSong(state.shuffledQueue, song, at) : state.shuffledQueue;
          return { queue, originalQueue: queue, shuffledQueue };
        }),

        addToQueueEnd: (song) => set(state => {
          const queue = [...state.queue, song];
          const shuffledQueue = state.isShuffled ? [...state.shuffledQueue, song] : state.shuffledQueue;
          return { queue, originalQueue: queue, shuffledQueue };
        }),

        removeFromQueue: (id) => set(state => {
          const active = getActiveQueue(state);
          const activeIdx = active.findIndex(s => s.id === id);
          const removingCurrent = state.currentSong?.id === id;
          const queue = syncRemovedSong(state.queue, id);
          const shuffledQueue = syncRemovedSong(state.shuffledQueue, id);
          if (!queue.length) return { queue: [], originalQueue: [], shuffledQueue: [], currentIndex: -1, currentSong: null, isPlaying: false, currentTime: 0 };
          if (!removingCurrent) {
            const currentIndex = state.isShuffled
              ? Math.max(0, shuffledQueue.findIndex(s => s.id === state.currentSong?.id))
              : Math.max(0, queue.findIndex(s => s.id === state.currentSong?.id));
            return { queue, originalQueue: queue, shuffledQueue, currentIndex };
          }
          const nextActive = state.isShuffled ? shuffledQueue : queue;
          const nextIndex = Math.min(activeIdx, nextActive.length - 1);
          return { queue, originalQueue: queue, shuffledQueue, currentIndex: nextIndex, currentSong: nextActive[nextIndex] ?? null, currentTime: 0, isPlaying: Boolean(nextActive[nextIndex]) };
        }),

        clearQueue: () => set({ queue: [], originalQueue: [], shuffledQueue: [], currentIndex: -1, currentSong: null, isPlaying: false, currentTime: 0 }),

        reorderQueue: (from, to) => set(state => {
          if (from === to || from < 0 || to < 0 || from >= state.queue.length || to >= state.queue.length) return {};
          const queue = [...state.queue];
          const [moved] = queue.splice(from, 1);
          queue.splice(to, 0, moved);
          const currentIndex = state.isShuffled ? state.currentIndex : Math.max(0, queue.findIndex(s => s.id === state.currentSong?.id));
          return { queue, originalQueue: queue, currentIndex };
        }),

        toggleLike: (id) => {
          if (!id) return;
          set(state => {
            const likedIds = new Set(state.likedIds);
            likedIds.has(id) ? likedIds.delete(id) : likedIds.add(id);
            return { likedIds };
          });
        },

        createPlaylist: (name) => {
          const id = `pl_${Date.now()}`;
          set(state => ({ playlists: [...state.playlists, { id, name, songs: [] }] }));
          return id;
        },

        addToPlaylist: (playlistId, song) => set(state => ({
          playlists: state.playlists.map(p =>
            p.id === playlistId && !p.songs.some(s => s.id === song.id)
              ? { ...p, songs: [...p.songs, song] }
              : p
          ),
        })),

        removeFromPlaylist: (playlistId, songId) => set(state => ({
          playlists: state.playlists.map(p =>
            p.id === playlistId ? { ...p, songs: p.songs.filter(s => s.id !== songId) } : p
          ),
        })),

        deletePlaylist: (playlistId) => set(state => ({
          playlists: state.playlists.filter(p => p.id !== playlistId),
        })),

        recordDownload: (song) => set(state => ({
          downloads: uniqById([{ ...song, downloadedAt: Date.now() }, ...state.downloads]).slice(0, 200),
        })),

        removeDownload: (songId) => set(state => ({
          downloads: state.downloads.filter(s => s.id !== songId),
        })),

        playPlaylist: (playlistId, startSong) => {
          const playlist = get().playlists.find(p => p.id === playlistId);
          if (!playlist?.songs?.length) return;
          // Own playlists do NOT force radio mode by default
          get().loadQueueAndPlay(playlist.songs, startSong || playlist.songs[0], false);
        },

        _addToHistory: (song) => {
          set(state => ({
            playHistory: [...state.playHistory, { ...song, playedAt: Date.now() }].slice(-200),
            playCounts: { ...state.playCounts, [song.id]: (state.playCounts[song.id] || 0) + 1 },
          }));
          // SimpMusic: Check radio maintenance on every new track start
          if (get().radioMode) get()._maintainRadioQueue();
        },

        openPlaylistPicker: (song) => set({ isPlaylistPickerOpen: true, songToAddToPlaylist: song }),
        closePlaylistPicker: () => set({ isPlaylistPickerOpen: false, songToAddToPlaylist: null }),
      }),
      {
        name: 'ak-music-player-storage',
        partialize: state => ({
          volume: state.volume,
          isMuted: state.isMuted,
          repeatMode: state.repeatMode,
          radioMode: state.radioMode,
          crossfade: state.crossfade,
          sponsorBlockEnabled: state.sponsorBlockEnabled,
          lyricsProvider: state.lyricsProvider,
          audioQuality: state.audioQuality,
          activeMood: state.activeMood,
          playHistory: state.playHistory,
          playCounts: state.playCounts,
          likedIds: Array.from(state.likedIds),
          playlists: state.playlists,
          downloads: state.downloads,
          queue: state.queue,
          currentSong: state.currentSong,
          currentIndex: state.currentIndex,
          currentTime: state.currentTime,
        }),
        merge: (persisted, current) => {
          const s = persisted || {};
          return { ...current, ...s, likedIds: new Set(s.likedIds || []), isPlaying: false };
        },
      },
    ),
  ),
);
