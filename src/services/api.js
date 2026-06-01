import axios from 'axios';
import { youtubeClient } from './youtubeClient';
import { streamResolver } from './streamResolver';
import { Capacitor } from '@capacitor/core';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const HAS_REMOTE_API = /^https?:\/\//i.test(API_BASE);

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000, // 30 seconds timeout
});

// Environment detection (only true on native Android/iOS app containers)
const isCapacitor = Capacitor.isNativePlatform();
let useClientSide = isCapacitor; // Default to client-side mode on mobile (serverless)
window.__backendAvailable = !isCapacitor; // Default backend availability to true on Web, false on mobile

// Check backend status to dynamically adjust client-side fallback
fetch(`${API_BASE}/health`)
  .then(r => r.json())
  .then(data => {
    if (data?.status === 'ok') {
      console.log('[API] Backend server detected. Running in Proxy mode.');
      window.__backendAvailable = true;
      useClientSide = false; // Backend is active, use it
    } else {
      console.warn('[API] Backend server returned unhealthy status.');
      window.__backendAvailable = false;
      useClientSide = isCapacitor; // Fall back to client-side on mobile
    }
  })
  .catch(() => {
    console.warn('[API] Backend server is offline or unreachable.');
    window.__backendAvailable = false;
    useClientSide = isCapacitor; // Fall back to client-side on mobile
  });

// ─── Formatting Helpers ───────────────────────────────────────────────────────
function pickThumbnail(item) {
  const t = item.thumbnails || item.thumbnail || [];
  let url = '';

  if (Array.isArray(t) && t.length > 0) {
    const largest = [...t].sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    url = largest.url;
  } else if (typeof t === 'string' && t.startsWith('http')) {
    url = t;
  } else if (typeof t === 'object' && t?.url) {
    url = t.url;
  }

  const videoId = item.videoId || item.id || null;

  // Prefer high-res YouTube poster directly for songs/videos
  if (videoId && videoId.length === 11) {
    return `https://i.ytimg.com/vi/${videoId}/hq720.jpg`;
  }

  if (url) {
    if (url.includes('googleusercontent.com') || url.includes('ggpht.com') || url.includes('lh3.googleusercontent.com')) {
      if (url.includes('=')) {
        url = url.replace(/=.*$/, '=w1080-h1080-l90-rj');
      } else {
        url = url + '=w1080-h1080-l90-rj';
      }
    }
  }

  if (!url && videoId && videoId.length === 11) {
    url = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }

  if (!url) {
    url = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title || 'Music')}&background=random&size=512`;
  }

  return url;
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function mapTrack(track) {
  if (!track) return null;
  const videoId = track.videoId || track.id;
  const title = track.title || track.name;
  const artistName = typeof track.artist === 'object' ? track.artist.name : (track.artist || 'Unknown Artist');
  
  return {
    id: videoId,
    videoId: videoId,
    title: title,
    artist: artistName,
    artists: track.artists || [{ name: artistName, id: track.artistId || null }],
    album: track.album ? { name: track.album.name, id: track.album.albumId || track.album.id } : null,
    thumbnail: pickThumbnail({ videoId, thumbnails: track.thumbnails || [], title }),
    duration: track.duration || formatDuration(track.durationSeconds || 0),
    durationSeconds: track.durationSeconds || 0,
    views: track.views || null,
    year: track.year || null,
    isExplicit: !!track.isExplicit,
    sourceType: track.type?.toLowerCase() || 'song',
  };
}

function mapBrowseItem(item) {
  if (!item) return null;
  const type = (item.type || 'collection').toLowerCase();
  
  if (type === 'song' || type === 'video') {
    return mapTrack(item);
  }
  
  const id = item.playlistId || item.albumId || item.artistId || item.id;
  const title = item.name || item.title;
  if (!id || !title) return null;
  
  let subtitle = item.subtitle || '';
  if (!subtitle) {
    if (type === 'album') {
      const artistName = typeof item.artist === 'object' ? item.artist.name : item.artist;
      subtitle = [artistName, item.year].filter(Boolean).join(' • ');
    } else if (type === 'playlist') {
      subtitle = 'Playlist';
    } else if (type === 'artist') {
      subtitle = 'Artist';
    }
  }

  return {
    id,
    type,
    title,
    subtitle,
    thumbnail: pickThumbnail({ id, thumbnails: item.thumbnails || [], title }),
    browseId: item.artistId || item.albumId || item.browseId || null,
    playlistId: item.playlistId || null,
    albumId: item.albumId || null,
    artistId: item.artistId || null,
  };
}

// ─── API Methods ─────────────────────────────────────────────────────────────
async function getData(request, fallback = null) {
  try {
    const response = await request;
    return response.data;
  } catch (error) {
    console.error('API request failed:', error);
    if (fallback !== null) return fallback;
    throw error;
  }
}

export const musicService = {
  getHome: async (mood = 'default') => {
    if (useClientSide) {
      try {
        const sections = await youtubeClient.getHomeSections();
        const charts = [];
        
        const formattedSections = sections.map(s => {
          const items = (s.items || []).map(mapBrowseItem).filter(Boolean);
          const shuffledItems = items.sort(() => Math.random() - 0.5);
          
          let title = s.title;
          if (title?.toLowerCase().includes('mixed for you')) title = 'Mixed for You';
          if (title?.toLowerCase().includes('listen again')) title = 'Listen Again';
          if (title?.toLowerCase().includes('recommended')) title = 'Recommended';
          
          if (s.title?.toLowerCase().includes('charts') || s.title?.toLowerCase().includes('trending')) {
            charts.push(...shuffledItems.filter(i => i.type === 'song'));
          }
          return { title, items: shuffledItems };
        }).filter(s => s.items.length > 5);

        // Discovery section
        const surpriseKeywords = ['Lofi study', 'Punjabi Pop', 'Global Top Hits', 'Indie Gems', '90s Bollywood', 'Chill Electronic', 'Techno 2024', 'Acoustic Soul', 'Workout Energetic'];
        const randomKeyword = surpriseKeywords[Math.floor(Math.random() * surpriseKeywords.length)];
        let surpriseTracks = [];
        try {
          const surpriseResults = await youtubeClient.searchSongs(randomKeyword);
          surpriseTracks = surpriseResults.map(mapTrack).filter(Boolean).sort(() => Math.random() - 0.5).slice(0, 16);
        } catch (err) {}
        
        const surpriseSection = { title: `Discovery: ${randomKeyword}`, items: surpriseTracks };

        // Finalize charts
        let finalCharts = charts.sort(() => Math.random() - 0.5).slice(0, 24);
        if (finalCharts.length === 0) {
          try {
            const fallback = await youtubeClient.searchSongs(mood !== 'default' ? mood : 'trending songs');
            finalCharts = fallback.map(mapTrack).filter(Boolean).sort(() => Math.random() - 0.5).slice(0, 24);
          } catch (err) {}
        }

        return {
          charts: finalCharts,
          sections: [surpriseSection, ...formattedSections.sort(() => Math.random() - 0.5)],
          moods: [],
          activeMood: mood,
        };
      } catch (err) {
        console.error('client getHome failed, returning empty:', err);
        return { charts: [], sections: [], moods: [] };
      }
    }
    return getData(api.get('/home', { params: { mood } }), { charts: [], sections: [], moods: [] });
  },

  getCharts: async (country = 'IN') => {
    if (useClientSide) {
      try {
        const results = await youtubeClient.searchSongs('top hits');
        return results.map(mapTrack).filter(Boolean).slice(0, 20);
      } catch (err) {
        return [];
      }
    }
    return getData(api.get('/charts', { params: { country } }), []);
  },

  search: async (query) => {
    if (useClientSide) {
      const results = await youtubeClient.searchSongs(query);
      return results.map(mapTrack).filter(Boolean);
    }
    return getData(api.get(`/search/${encodeURIComponent(query)}`), []);
  },

  searchCatalog: async (query) => {
    if (useClientSide) {
      try {
        const [songs, videos, albums, artists, playlists, suggestions] = await Promise.all([
          youtubeClient.searchSongs(query).catch(() => []),
          youtubeClient.searchVideos(query).catch(() => []),
          youtubeClient.searchAlbums(query).catch(() => []),
          youtubeClient.searchArtists(query).catch(() => []),
          youtubeClient.searchPlaylists(query).catch(() => []),
          youtubeClient.getSearchSuggestions(query).catch(() => []),
        ]);

        const normalizedSongs = songs.map(mapTrack).filter(Boolean);
        const normalizedVideos = videos.map(mapTrack).filter(Boolean);
        const normalizedAlbums = albums.map(mapBrowseItem).filter(Boolean);
        const normalizedArtists = artists.map(mapBrowseItem).filter(Boolean);
        const normalizedPlaylists = playlists.map(mapBrowseItem).filter(Boolean);

        let top = [];
        if (normalizedArtists.length >= 3) {
          top = [...normalizedArtists.slice(0, 3), ...normalizedSongs, ...normalizedVideos, ...normalizedAlbums, ...normalizedPlaylists];
        } else {
          top = [...normalizedArtists, ...normalizedSongs, ...normalizedVideos, ...normalizedAlbums, ...normalizedPlaylists];
        }

        return {
          suggestions: suggestions.slice(0, 8),
          top: top.slice(0, 15),
          songs: normalizedSongs,
          videos: normalizedVideos,
          albums: normalizedAlbums,
          artists: normalizedArtists.slice(0, 8),
          playlists: normalizedPlaylists,
        };
      } catch (err) {
        console.error('client searchCatalog failed:', err);
        return { suggestions: [], top: [], songs: [], videos: [], albums: [], artists: [], playlists: [] };
      }
    }
    return getData(api.get(`/search-all/${encodeURIComponent(query)}`), {
      suggestions: [],
      top: [],
      songs: [],
      videos: [],
      albums: [],
      artists: [],
      playlists: [],
    });
  },

  getSearchSuggestions: async (query) => {
    if (useClientSide) {
      const suggestions = await youtubeClient.getSearchSuggestions(query);
      return suggestions.slice(0, 8);
    }
    return getData(api.get(`/search-suggestions/${encodeURIComponent(query)}`), []);
  },

  getMoodPlaylists: async (params) => {
    if (useClientSide) {
      return [];
    }
    return getData(api.get('/mood-playlists', { params: { params } }), []);
  },

  resolveCollection: async (kind, id) => {
    if (useClientSide) {
      try {
        let title = 'Unknown';
        let tracks = [];
        
        if (kind === 'playlist') {
          const playlist = await youtubeClient.getPlaylist(id);
          title = playlist.name || 'Playlist';
          const list = await youtubeClient.getPlaylistVideos(id);
          tracks = list.map(mapTrack).filter(Boolean);
        } else if (kind === 'album') {
          const album = await youtubeClient.getAlbum(id);
          title = album.title || 'Album';
          tracks = (album.songs || []).map(mapTrack).filter(Boolean);
        } else if (kind === 'artist') {
          const artist = await youtubeClient.getArtist(id);
          title = artist.name || 'Artist';
          const list = await youtubeClient.getArtistSongs(id);
          tracks = list.map(mapTrack).filter(Boolean);
        }
        
        return { title, tracks };
      } catch (err) {
        console.error('client resolveCollection failed:', err);
        return { title: '', tracks: [] };
      }
    }
    return getData(api.get('/resolve', { params: { kind, id } }), { title: '', tracks: [] });
  },

  getArtistRadio: async (artistId) => {
    if (useClientSide) {
      try {
        const artist = await youtubeClient.getArtist(artistId);
        const topSongs = (artist.topSongs || []).map(mapTrack).filter(Boolean);
        const similarArtists = (artist.similarArtists || []).slice(0, 5);

        const similarTracks = await Promise.all(
          similarArtists.map(async a => {
            try {
              const detail = await youtubeClient.getArtist(a.artistId || a.id);
              return (detail.topSongs || []).slice(0, 3).map(mapTrack).filter(Boolean);
            } catch { return []; }
          })
        );

        const pool = [...topSongs, ...similarTracks.flat()];
        return pool.sort(() => Math.random() - 0.5);
      } catch (err) {
        return [];
      }
    }
    return getData(api.get(`/artist-radio/${artistId}`), []);
  },

  getPlaylist: async (playlistId) => {
    if (useClientSide) {
      const list = await youtubeClient.getPlaylistVideos(playlistId);
      return list.map(mapTrack).filter(Boolean);
    }
    return getData(api.get(`/playlist/${playlistId}`), []);
  },

  getAlbum: async (albumId) => {
    if (useClientSide) {
      const album = await youtubeClient.getAlbum(albumId);
      return (album.songs || []).map(mapTrack).filter(Boolean);
    }
    return getData(api.get(`/album/${albumId}`), []);
  },

  getWatchPlaylist: async (videoId) => {
    if (useClientSide) {
      return youtubeClient.getUpNexts(videoId);
    }
    return getData(api.get(`/watch-playlist/${videoId}`), []);
  },

  getRelated: async (videoId) => {
    if (useClientSide) {
      return youtubeClient.getUpNexts(videoId);
    }
    return getData(api.get(`/related/${videoId}`), []);
  },

  getRadio: async (videoId) => {
    if (useClientSide) {
      return youtubeClient.getUpNexts(videoId);
    }
    return getData(api.get(`/radio/${videoId}`), []);
  },

  getLyrics: async (song, provider = 'auto') => {
    if (useClientSide) {
      try {
        const rawLyrics = await youtubeClient.getLyrics(song.id);
        if (rawLyrics) {
          return { provider: 'YouTube Music', source: 'YouTube Music', synced: false, text: rawLyrics, lines: [] };
        }
        
        // LRCLIB fallback
        const cleanTitle = (song.title || '').replace(/\(.*\)|\[.*\]/g, '').trim();
        const cleanArtist = (song.artist || '').replace(/\(.*\)|\[.*\]/g, '').trim();
        
        if (cleanTitle && cleanArtist) {
          const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`);
          if (res.ok) {
            const best = await res.json();
            if (best.syncedLyrics || best.plainLyrics) {
              const synced = best.syncedLyrics;
              if (synced) {
                const lines = [];
                synced.split('\n').forEach(line => {
                  const text = line.replace(/\[[^\]]+\]/g, '').trim();
                  const localRegex = /\[(\d+):(\d+(?:\.\d+)?)\]/g;
                  let match;
                  while ((match = localRegex.exec(line)) !== null) {
                    lines.push({ text, startTime: parseInt(match[1]) * 60 + parseFloat(match[2]), endTime: null });
                  }
                });
                lines.sort((a, b) => a.startTime - b.startTime);
                for (let i = 0; i < lines.length - 1; i++) lines[i].endTime = lines[i + 1].startTime;
                return { provider: 'LRCLIB', source: 'LRCLIB', synced: true, text: synced, lines: lines.filter(l => l.text) };
              }
              return { provider: 'LRCLIB', source: 'LRCLIB', synced: false, text: best.plainLyrics || '', lines: [] };
            }
          }
        }
      } catch (err) {
        console.warn('client-side lyrics failed:', err);
      }
      return { provider: null, source: null, synced: false, text: '', lines: [] };
    }
    
    return getData(
      api.get(`/lyrics/${encodeURIComponent(song.id)}`, {
        params: {
          provider,
          title: song.title,
          artist: song.artist,
        },
      }),
      {
        provider: null,
        source: null,
        synced: false,
        text: '',
        lines: [],
      },
    );
  },

  getStreamUrl: async (videoId, quality = 'high') => {
    if (useClientSide) {
      return streamResolver.getStreamUrl(videoId, quality);
    }

    // In backend mode, fetch the resolved direct CDN audio URL from the server.
    // This allows the browser/app to play directly from googlevideo.com without proxy bottlenecks.
    try {
      const response = await fetch(`${API_BASE}/stream/${encodeURIComponent(videoId)}?quality=${encodeURIComponent(quality)}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.url) {
          return data.url;
        }
      }
    } catch (err) {
      console.warn('[API] Failed to fetch resolved stream from backend, falling back to local proxy endpoint:', err);
    }

    // Fallback to Express proxied stream if direct URL lookup fails
    return `${API_BASE}/audio/${encodeURIComponent(videoId)}?quality=${encodeURIComponent(quality)}&t=${Date.now()}`;
  },

  getDownloadUrl: (videoId, title = '') => {
    // Standard link download endpoint (used on browser/local proxy dev only)
    return `${API_BASE}/download/${videoId}?title=${encodeURIComponent(title)}`;
  },

  getFallbackAudioUrl: (songId) => `${API_BASE}/fallback-audio/${encodeURIComponent(songId)}`,
};
