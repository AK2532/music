import express from 'express';
import cors from 'cors';
import YTMusic from 'ytmusic-api';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import axios from 'axios';
import { LRUCache } from 'lru-cache';
import play from 'play-dl';

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Range', 'Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges', 'Content-Type'],
  credentials: false,
}));
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`${new Date().toLocaleTimeString()} [API] ${req.method} ${req.url}`);
  next();
});

const ytmusic = new YTMusic();
await ytmusic.initialize();

// ─── Cookie Setup ─────────────────────────────────────────────────────────────
let COOKIES_FILE = null;
const rawCookies = process.env.YOUTUBE_COOKIES;
if (rawCookies) {
  try {
    // Clean the cookie string (remove accidental quotes or whitespace)
    const cleanedCookies = rawCookies.trim().replace(/^["']|["']$/g, '');
    COOKIES_FILE = join(process.cwd(), 'yt_cookies.txt');
    writeFileSync(COOKIES_FILE, cleanedCookies, 'utf-8');
    const firstLine = cleanedCookies.split('\n')[0].slice(0, 50);
    console.log(`[Cookies] Cleaned & Loaded. First line: ${firstLine}`);
  } catch (e) {
    console.warn('[Cookies] Failed to write cookies file:', e.message);
    COOKIES_FILE = null;
  }
} else {
  console.warn('[Cookies] No YOUTUBE_COOKIES env var found.');
}

const streamCache = new LRUCache({ max: 1000, ttl: 1000 * 60 * 60 * 4 }); // 4hr cache (URLs valid ~6hr)
const relatedCache = new LRUCache({ max: 500, ttl: 1000 * 60 * 30 });
const homeCache = new LRUCache({ max: 20, ttl: 1000 * 30 });

// ─── SimpMusic Mood Params (copied directly) ──────────────────────────────────
const HOME_PARAMS = {
  relax: 'ggM8SgQIBxADSgQIBRABSgQICRABSgQIChABSgQIDRABSgQICBABSgQIBBABSgQIDhABSgQIAxABSgQIBhAB',
  sleep: 'ggM8SgQIBxABSgQIBRADSgQICRABSgQIChABSgQIDRABSgQICBABSgQIBBABSgQIDhABSgQIAxABSgQIBhAB',
  energize: 'ggM8SgQIBxABSgQIBRABSgQICRADSgQIChABSgQIDRABSgQICBABSgQIBBABSgQIDhABSgQIAxABSgQIBhAB',
  sad: 'ggM8SgQIBxABSgQIBRABSgQICRABSgQIChADSgQIDRABSgQICBABSgQIBBABSgQIDhABSgQIAxABSgQIBhAB',
  romance: 'ggM8SgQIBxABSgQIBRABSgQICRABSgQIChABSgQIDRADSgQICBABSgQIBBABSgQIDhABSgQIAxABSgQIBhAB',
  feel_good: 'ggM8SgQIBxABSgQIBRABSgQICRABSgQIChABSgQIDRABSgQICBADSgQIBBABSgQIDhABSgQIAxABSgQIBhAB',
  workout: 'ggM8SgQIBxABSgQIBRABSgQICRABSgQIChABSgQIDRABSgQICBABSgQIBBADSgQIDhABSgQIAxABSgQIBhAB',
  party: 'ggM8SgQIBxABSgQIBRABSgQICRABSgQIChABSgQIDRABSgQICBABSgQIBBABSgQIDhADSgQIAxABSgQIBhAB',
  commute: 'ggM8SgQIBxABSgQIBRABSgQICRABSgQIChABSgQIDRABSgQICBABSgQIBBABSgQIDhABSgQIAxADSgQIBhAB',
  focus: 'ggM8SgQIBxABSgQIBRABSgQICRABSgQIChABSgQIDRABSgQICBABSgQIBBABSgQIDhABSgQIAxABSgQIBhAD',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeArtists(item) {
  const artists = item.artists || item.artist || [];
  if (Array.isArray(artists)) return artists.map(a => ({ name: a.name || 'Unknown', id: a.artistId || a.id || null }));
  if (typeof artists === 'object' && artists?.name) return [{ name: artists.name, id: artists.artistId || null }];
  if (typeof artists === 'string') return [{ name: artists, id: null }];
  return [];
}

function primaryArtistName(item) {
  const a = normalizeArtists(item);
  return a.length > 0 ? a[0].name : 'Unknown';
}

function pickThumbnail(item) {
  const t = item.thumbnails || item.thumbnail || item.image || item.images || [];
  let url = '';

  if (Array.isArray(t) && t.length > 0) {
    // Try to find the largest one
    const largest = [...t].sort((a, b) => (b.width || 0) - (a.width || 0))[0];
    url = largest.url;
  } else if (typeof t === 'string' && t.startsWith('http')) {
    url = t;
  } else if (typeof t === 'object' && t?.url) {
    url = t.url;
  }

  const videoId = item.videoId || item.id || null;

  // PRIORITY: If it's a song/video, use the high-res YouTube poster directly.
  // This is much more reliable than googleusercontent URLs which often 403.
  if (videoId && videoId.length === 11) {
    return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  }

  if (url) {
    if (url.includes('googleusercontent.com') || url.includes('ggpht.com') || url.includes('lh3.googleusercontent.com')) {
      // Ensure we get a high-res version if it's a google URL
      if (url.includes('=')) {
        url = url.replace(/=.*$/, '=w1080-h1080-l90-rj');
      } else {
        url = url + '=w1080-h1080-l90-rj';
      }
    }
  }

  // Final fallback to HQ if maxres failed or wasn't tried
  if (!url && videoId && videoId.length === 11) {
    url = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }

  // If we still have nothing, use the title-based fallback
  if (!url) {
    url = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title || 'Music')}&background=random&size=512`;
  }

  return url;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function normalizeTrack(item, fallbackType = 'song') {
  const videoId = item.videoId || item.id;
  const title = item.name || item.title;
  if (!videoId || !title) return null;
  return {
    id: videoId,
    videoId,
    title,
    artist: primaryArtistName(item),
    artists: normalizeArtists(item),
    album: item.album ? { name: item.album.name, id: item.album.albumId } : null,
    thumbnail: pickThumbnail(item),
    duration: formatDuration(item.duration || 0),
    durationSeconds: item.duration || 0,
    views: item.views || null,
    year: item.year || null,
    isExplicit: !!item.isExplicit,
    sourceType: item.type?.toLowerCase() || fallbackType,
  };
}

function normalizeBrowseItem(item) {
  const type = (item.type || 'collection').toLowerCase();
  if (type === 'song' || type === 'video') return normalizeTrack(item, type);
  const id = item.playlistId || item.albumId || item.artistId || item.id;
  const title = item.name || item.title;
  if (!id || !title) return null;
  let subtitle = '';
  if (type === 'album') subtitle = [primaryArtistName(item), item.year].filter(Boolean).join(' • ');
  else if (type === 'playlist') subtitle = 'Playlist';
  else if (type === 'artist') subtitle = 'Artist';
  return { id, type, title, subtitle, thumbnail: pickThumbnail(item), browseId: item.artistId || item.albumId || null, playlistId: item.playlistId || null };
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Routes ───────────────────────────────────────────────────────────────────

// Home – supports ?mood= (relax, energize, focus, etc.) just like SimpMusic
app.get('/api/home', async (req, res) => {
  const mood = req.query.mood?.toLowerCase() || 'default';
  const params = HOME_PARAMS[mood] || null;

  try {
    const sections = await ytmusic.getHomeSections();
    const charts = [];

    // 1. Process standard sections with shuffling
    const formattedSections = sections.map(s => {
      const items = (s.contents || []).map(normalizeBrowseItem).filter(Boolean);
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

    // 2. Add a TRULY random discovery section to ensure it's different every time
    const surpriseKeywords = ['Lofi study', 'Punjabi Pop', 'Global Top Hits', 'Indie Gems', '90s Bollywood', 'Chill Electronic', 'Techno 2024', 'Acoustic Soul', 'Workout Energetic'];
    const randomKeyword = surpriseKeywords[Math.floor(Math.random() * surpriseKeywords.length)];
    const surpriseResults = await ytmusic.searchSongs(randomKeyword);
    const surpriseTracks = surpriseResults.map(s => normalizeTrack(s)).filter(Boolean).sort(() => Math.random() - 0.5).slice(0, 16);
    const surpriseSection = { title: `Discovery: ${randomKeyword}`, items: surpriseTracks };

    // 3. Finalize charts and sections
    let finalCharts = charts.sort(() => Math.random() - 0.5).slice(0, 24);
    if (finalCharts.length === 0) {
      const fallback = await ytmusic.searchSongs(mood !== 'default' ? mood : 'trending songs');
      finalCharts = fallback.map(s => normalizeTrack(s)).filter(Boolean).sort(() => Math.random() - 0.5).slice(0, 24);
    }

    const payload = {
      charts: finalCharts,
      sections: [surpriseSection, ...formattedSections.sort(() => Math.random() - 0.5)],
      moods: [],
      activeMood: mood,
    };

    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Search – SimpMusic-style: artists prioritized (top 3), then songs/videos/albums/playlists
app.get('/api/search-all/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const [songs, videos, albums, artists, playlists] = await Promise.all([
      ytmusic.searchSongs(query).catch(() => []),
      ytmusic.searchVideos(query).catch(() => []),
      ytmusic.searchAlbums(query).catch(() => []),
      ytmusic.searchArtists(query).catch(() => []),
      ytmusic.searchPlaylists(query).catch(() => []),
    ]);

    const suggestions = await ytmusic.getSearchSuggestions(query).catch(() => []);

    // SimpMusic algorithm: if ≥3 artists show top 3 first, then songs, albums, playlists
    const normalizedArtists = artists.map(normalizeBrowseItem).filter(Boolean);
    const normalizedSongs = songs.map(s => normalizeTrack(s)).filter(Boolean).slice(0, 12);
    const normalizedVideos = videos.map(s => normalizeTrack(s, 'video')).filter(Boolean).slice(0, 8);
    const normalizedAlbums = albums.map(normalizeBrowseItem).filter(Boolean).slice(0, 8);
    const normalizedPlaylists = playlists.map(normalizeBrowseItem).filter(Boolean).slice(0, 8);

    let top = [];
    if (normalizedArtists.length >= 3) {
      top = [...normalizedArtists.slice(0, 3), ...normalizedSongs, ...normalizedVideos, ...normalizedAlbums, ...normalizedPlaylists];
    } else {
      top = [...normalizedArtists, ...normalizedSongs, ...normalizedVideos, ...normalizedAlbums, ...normalizedPlaylists];
    }

    res.json({
      suggestions: suggestions.slice(0, 8),
      top: top.slice(0, 15),
      songs: normalizedSongs,
      videos: normalizedVideos,
      albums: normalizedAlbums,
      artists: normalizedArtists.slice(0, 8),
      playlists: normalizedPlaylists,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Basic song search
app.get('/api/search/:query', async (req, res) => {
  try {
    const results = await ytmusic.searchSongs(req.params.query);
    res.json(results.map(s => normalizeTrack(s)).filter(Boolean));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search suggestions
app.get('/api/search-suggestions/:query', async (req, res) => {
  try {
    const suggestions = await ytmusic.getSearchSuggestions(req.params.query);
    res.json(suggestions.slice(0, 8));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Collection resolve (playlist / album / artist)
app.get('/api/resolve', async (req, res) => {
  const { kind, id } = req.query;
  if (!kind || !id) return res.status(400).json({ error: 'Missing kind or id' });
  try {
    let title = 'Unknown', tracks = [];
    if (kind === 'playlist') {
      try {
        let fetchId = id;
        if (id.startsWith('RD') && !id.startsWith('RDAM')) {
          fetchId = 'VL' + id;
        }

        let data;
        try {
          data = await ytmusic.getPlaylist(fetchId);
        } catch (e) {
          if (!fetchId.startsWith('VL')) {
            data = await ytmusic.getPlaylist('VL' + fetchId);
            fetchId = 'VL' + fetchId;
          } else {
            throw e;
          }
        }

        title = data.name || data.title || 'Playlist';
        let rawTracks = data.tracks || data.songs || data.content || [];

        if (!rawTracks.length) {
          try {
            rawTracks = await ytmusic.getPlaylistVideos(fetchId);
          } catch (e) { }
        }

        tracks = (Array.isArray(rawTracks) ? rawTracks : []).map(v => normalizeTrack(v)).filter(Boolean);
      } catch (e) {
        console.error('Playlist resolve failed:', e.message);
        // Fallback: search for the playlist name if we have it, or just return empty
      }
    } else if (kind === 'album') {
      try {
        const data = await ytmusic.getAlbum(id);
        title = data.name || data.title || 'Album';
        const rawTracks = data.tracks || data.songs || data.content || [];
        tracks = (Array.isArray(rawTracks) ? rawTracks : []).map(s => normalizeTrack(s)).filter(Boolean);
      } catch (e) {
        console.error('Album resolve failed:', e.message);
      }
    } else if (kind === 'artist') {
      try {
        const data = await ytmusic.getArtist(id);
        title = data.name || data.title || 'Artist';
        const songs = await ytmusic.getArtistSongs(id);
        tracks = (Array.isArray(songs) ? songs : []).map(s => normalizeTrack(s)).filter(Boolean);
      } catch (e) {
        console.error('Artist resolve failed:', e.message);
      }
    }
    res.json({ title, tracks });
  } catch (error) {
    console.error('Global resolve error:', error);
    res.status(500).json({ error: 'Failed to resolve collection' });
  }
});

// Artist Radio – Personalized discovery based on an artist
app.get('/api/artist-radio/:artistId', async (req, res) => {
  const { artistId } = req.params;
  try {
    const artist = await ytmusic.getArtist(artistId);
    const topSongs = (artist.topSongs || []).map(s => normalizeTrack(s)).filter(Boolean);
    const similarArtists = (artist.similarArtists || []).slice(0, 5);

    // Fetch top songs from similar artists to build a "Radio" feel
    const similarTracks = await Promise.all(
      similarArtists.map(async a => {
        try {
          const detail = await ytmusic.getArtist(a.artistId);
          return (detail.topSongs || []).slice(0, 3).map(s => normalizeTrack(s)).filter(Boolean);
        } catch { return []; }
      })
    );

    const pool = [...topSongs, ...similarTracks.flat()];
    // Shuffle the pool for a fresh radio feel
    res.json(pool.sort(() => Math.random() - 0.5));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Related / Radio – Smarter Discovery Algo
app.get('/api/related/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const cacheKey = `related_v2:${videoId}`;
  if (relatedCache.has(cacheKey)) return res.json(relatedCache.get(cacheKey));

  try {
    // 1. Get YouTube Music's "Watch Next" list (Core Algo)
    const upNext = await ytmusic.getUpNexts(videoId);
    let pool = upNext.map(s => normalizeTrack(s)).filter(Boolean);

    // 2. If pool is too small, supplement with search-based discovery
    if (pool.length < 10) {
      const current = pool[0]; // Usually the first item is the source or closest match
      if (current?.artist) {
        const fallback = await ytmusic.searchSongs(`${current.artist} radio`);
        pool = [...pool, ...fallback.map(s => normalizeTrack(s)).filter(Boolean)];
      }
    }

    // 3. Deduplicate and remove self
    const seen = new Set([videoId]);
    const result = [];
    for (const track of pool) {
      if (!seen.has(track.id)) {
        seen.add(track.id);
        result.push(track);
      }
    }

    const final = result.slice(0, 25);
    relatedCache.set(cacheKey, final);
    res.json(final);
  } catch (error) {
    // Fallback to simple search if core fails
    try {
      const fallback = await ytmusic.searchSongs(videoId); // Try searching by ID to find title
      res.json(fallback.map(s => normalizeTrack(s)).filter(Boolean).slice(0, 10));
    } catch {
      res.status(500).json({ error: error.message });
    }
  }
});

// Watch Playlist – YouTube Music's core recommendation algorithm
// Chains multiple getUpNexts calls to build a deep, algorithmic queue.
app.get('/api/watch-playlist/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const cacheKey = `watchpl:${videoId}`;
  if (relatedCache.has(cacheKey)) return res.json(relatedCache.get(cacheKey));

  try {
    // Stage 1: Get YouTube Music's primary "Watch Next" list
    const upNext = await ytmusic.getUpNexts(videoId);
    const primaryPool = upNext.map(s => normalizeTrack(s)).filter(Boolean);

    // Stage 2: Chain a second fetch from the last track to deepen the queue
    let secondaryPool = [];
    if (primaryPool.length > 3) {
      const seedTrack = primaryPool[primaryPool.length - 1];
      try {
        const deeper = await ytmusic.getUpNexts(seedTrack.id);
        secondaryPool = deeper.map(s => normalizeTrack(s)).filter(Boolean);
      } catch (_) { }
    }

    // Stage 3: Deduplicate and exclude the source song
    const seen = new Set([videoId]);
    const result = [];
    for (const track of [...primaryPool, ...secondaryPool]) {
      if (!seen.has(track.id)) {
        seen.add(track.id);
        result.push(track);
      }
    }

    const final = result.slice(0, 50);
    relatedCache.set(cacheKey, final);
    res.json(final);
  } catch (error) {
    // Fallback: try the basic related endpoint logic
    try {
      const related = await ytmusic.getUpNexts(videoId);
      const result = related.map(s => normalizeTrack(s)).filter(Boolean).filter(t => t.id !== videoId);
      res.json(result.slice(0, 25));
    } catch {
      res.status(500).json({ error: error.message });
    }
  }
});

app.get('/api/radio/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const cacheKey = `radio:${videoId}`;
  if (relatedCache.has(cacheKey)) return res.json(relatedCache.get(cacheKey));
  try {
    const related = await ytmusic.getUpNexts(videoId);
    const result = related.map(s => normalizeTrack(s)).filter(Boolean).filter(t => t.id !== videoId);
    relatedCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lyrics
app.get('/api/lyrics/:videoId', async (req, res) => {
  const { title, artist } = req.query;
  const videoId = req.params.videoId;

  try {
    // 1. Try YouTube Music first
    try {
      const lyrics = await ytmusic.getLyrics(videoId);
      if (lyrics?.lyrics) {
        console.log(`[Lyrics] Found on YouTube Music for ${videoId}`);
        return res.json({ provider: 'YouTube Music', source: 'YouTube Music', synced: false, text: lyrics.lyrics, lines: [] });
      }
    } catch (e) {
      console.warn(`[Lyrics] YouTube Music fetch failed for ${videoId}:`, e.message);
    }

    // 2. Try LRCLIB with refined search
    const cleanTitle = (title || '').replace(/\(.*\)|\[.*\]/g, '').trim();
    const cleanArtist = (artist || '').replace(/\(.*\)|\[.*\]/g, '').trim();

    if (cleanTitle && cleanArtist) {
      try {
        // 2a. Try exact match first (most reliable)
        const getRes = await axios.get('https://lrclib.net/api/get', { 
          params: { artist_name: cleanArtist, track_name: cleanTitle }, 
          timeout: 4000 
        });
        
        if (getRes.data && (getRes.data.syncedLyrics || getRes.data.plainLyrics)) {
          const best = getRes.data;
          console.log(`[Lyrics] Exact match on LRCLIB for ${cleanTitle}`);
          return res.json(formatLrcResponse(best));
        }
      } catch (e) {
        console.warn(`[Lyrics] LRCLIB exact get failed:`, e.message);
      }

      // 2b. Try search if exact failed, but with STRICTOR validation
      try {
        const lrcRes = await axios.get('https://lrclib.net/api/search', { 
          params: { q: `${cleanTitle} ${cleanArtist}` }, 
          timeout: 4000 
        });
        
        const results = lrcRes.data.filter(i => i.syncedLyrics || i.plainLyrics);
        if (results.length > 0) {
          // Filter results for those that actually match our artist
          const artistWords = cleanArtist.toLowerCase().split(/\s+/).filter(w => w.length > 2);
          const filtered = results.filter(item => {
            const resultArtist = (item.artistName || '').toLowerCase();
            return artistWords.some(word => resultArtist.includes(word));
          });

          if (filtered.length > 0) {
            const scored = filtered.map(item => {
              let score = 0;
              const text = item.syncedLyrics || item.plainLyrics || '';
              if (item.syncedLyrics) score += 10;
              
              // Prefer Romanized/ASCII text
              const asciiChars = (text.match(/[a-zA-Z]/g) || []).length;
              const totalChars = text.replace(/\s+/g, '').length || 1;
              if ((asciiChars / totalChars) > 0.4) score += 20;
              
              if (item.trackName?.toLowerCase() === cleanTitle.toLowerCase()) score += 10;
              
              return { item, score };
            });
            
            scored.sort((a, b) => b.score - a.score);
            const best = scored[0].item;
            console.log(`[Lyrics] Found on LRCLIB via search for ${cleanTitle}`);
            return res.json(formatLrcResponse(best));
          }
        }
      } catch (_) { }
    }

    function formatLrcResponse(best) {
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

    // 3. Try lyrics.ovh
    if (cleanArtist && cleanTitle) {
      try {
        const ovhRes = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`, { timeout: 3000 });
        if (ovhRes.data?.lyrics) {
          console.log(`[Lyrics] Found on lyrics.ovh for ${cleanTitle}`);
          // some ovh lyrics start with "Paroles de la chanson..." which we can optionally strip, but we'll take it raw.
          return res.json({ provider: 'lyrics.ovh', source: 'lyrics.ovh', synced: false, text: ovhRes.data.lyrics, lines: [] });
        }
      } catch (_) { }
    }

    res.json({ provider: null, source: null, synced: false, text: '', lines: [] });
  } catch (err) {
    console.error(`[Lyrics] Total failure for ${videoId}:`, err.message);
    res.json({ provider: null, source: null, synced: false, text: '', lines: [] });
  }
});

// Charts
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  try {
    const results = await ytmusic.search(q);
    const formatted = results.map(normalizeBrowseItem).filter(Boolean);
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/playlist/:playlistId', async (req, res) => {
  const { playlistId } = req.params;
  try {
    const playlist = await ytmusic.getPlaylist(playlistId);
    const tracks = (playlist.videos || []).map(v => normalizeTrack(v)).filter(Boolean);
    res.json(tracks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/album/:albumId', async (req, res) => {
  const { albumId } = req.params;
  try {
    const album = await ytmusic.getAlbum(albumId);
    const tracks = (album.songs || []).map(s => normalizeTrack(s)).filter(Boolean);
    res.json(tracks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/charts', async (req, res) => {
  try {
    const results = await ytmusic.searchSongs('top hits');
    res.json(results.map(s => normalizeTrack(s)).filter(Boolean).slice(0, 20));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Streaming ────────────────────────────────────────────────────────────────
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('yt-dlp', args);
    let out = '', err = '';
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
    child.on('close', code => {
      if (code === 0) {
        const url = out.trim().split('\n')[0].trim();
        if (url) resolve(url);
        else reject(new Error('yt-dlp returned no URL'));
      } else {
        reject(new Error(err.trim()));
      }
    });
    child.on('error', e => reject(new Error(`spawn error: ${e.message}`)));
  });
}

async function getStreamUrl(videoId) {
  if (streamCache.has(videoId)) return streamCache.get(videoId);

  // ─── PRIMARY: play-dl (Built for Datacenter Bot Bypass) ───
  try {
    console.log(`[Stream] Attempting play-dl for ${videoId}...`);
    const info = await play.video_info(videoId);
    const format = info.format.find(f => f.hasAudio && !f.hasVideo) || info.format[0];
    if (format?.url) {
      console.log(`[Stream] play-dl SUCCEEDED for ${videoId}`);
      streamCache.set(videoId, format.url);
      return format.url;
    }
  } catch (playErr) {
    console.warn(`[Stream] play-dl failed: ${playErr.message}. Falling back to yt-dlp...`);
  }

  // ─── SECONDARY: yt-dlp with Cookies & Client Spoofing ───
  // Cookie Format Check
  if (COOKIES_FILE && existsSync(COOKIES_FILE)) {
    try {
      const content = readFileSync(COOKIES_FILE, 'utf-8');
      if (!content.includes('# Netscape')) {
        console.error('[Cookies] WARNING: Your YOUTUBE_COOKIES does not look like a Netscape file. It must start with "# Netscape"!');
      }
    } catch (e) {
      console.warn('[Cookies] Failed to verify cookie format:', e.message);
    }
  }

  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const baseFlags = [
    '-g',
    '--no-warnings',
    '--no-playlist',
    '--ignore-config',
    '--no-check-certificates',
    '--socket-timeout', '30',
    '--user-agent', USER_AGENT,
    '--add-header', 'Accept-Language: en-US,en;q=0.9',
  ];

  if (COOKIES_FILE && existsSync(COOKIES_FILE)) {
    baseFlags.push('--cookies', COOKIES_FILE);
  }

  const attempts = [
    { name: 'TV Client', args: [...baseFlags, '-f', 'ba/best', '--extractor-args', 'youtube:player_client=tvhtml5', ytUrl] },
    { name: 'iOS/Web', args: [...baseFlags, '-f', 'ba[ext=m4a]/ba/best', '--extractor-args', 'youtube:player_client=ios,web', ytUrl] },
    { name: 'Android', args: [...baseFlags, '-f', 'ba/best', '--extractor-args', 'youtube:player_client=android', ytUrl] },
    { name: 'Emergency', args: [...baseFlags, '-f', 'b/worst', ytUrl] }
  ];

  let lastError = '';
  for (const attempt of attempts) {
    try {
      const url = await runYtDlp(attempt.args);
      console.log(`[Stream] ${attempt.name} succeeded for ${videoId}`);
      streamCache.set(videoId, url);
      return url;
    } catch (e) {
      lastError = e.message;
      const isBot = e.message.includes('confirm you’re not a bot') || e.message.includes('Sign in');
      console.warn(`[Stream] ${attempt.name} failed: ${isBot ? 'BOT DETECTION' : e.message.slice(0, 80)}`);
      if (e.message.includes('not available')) continue;
    }
  }

  throw new Error(`YouTube Blocked: ${lastError.slice(0, 150)}`);
}

app.get('/api/stream/:videoId', async (req, res) => {
  try {
    const url = await getStreamUrl(req.params.videoId);
    const headers = { 'User-Agent': USER_AGENT, 'Accept': '*/*', 'Connection': 'keep-alive' };
    if (req.headers.range) headers['Range'] = req.headers.range;
    const response = await axios({ method: 'get', url, responseType: 'stream', headers, validateStatus: () => true, timeout: 15000 });
    res.status(response.status);
    ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'].forEach(h => {
      if (response.headers[h]) res.setHeader(h, response.headers[h]);
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    response.data.on('error', () => res.end());
    response.data.pipe(res);
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

app.get('/api/download/:videoId', async (req, res) => {
  try {
    const url = await getStreamUrl(req.params.videoId);
    const response = await axios({ method: 'get', url, responseType: 'stream', headers: { 'User-Agent': USER_AGENT, 'Accept': '*/*' }, validateStatus: () => true, timeout: 30000 });
    const title = req.query.title || 'download';
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[\\/:*?"<>|]/g, '_')}.m4a"`);
    if (response.headers['content-type']) res.setHeader('Content-Type', response.headers['content-type']);
    if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);
    response.data.pipe(res);
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

const PORT = parseInt(process.env.PORT, 10) || 5001;
app.listen(PORT, () => console.log(`Node.js backend running on http://localhost:${PORT}`));
