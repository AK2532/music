import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000, // 15 seconds timeout
});

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
  getHome: (mood = 'default') => getData(api.get('/home', { params: { mood } }), {
    charts: [],
    sections: [],
    moods: [],
  }),

  getCharts: (country = 'IN') => getData(api.get('/charts', { params: { country } }), []),

  search: (query) => getData(api.get(`/search/${encodeURIComponent(query)}`), []),

  searchCatalog: (query) => getData(api.get(`/search-all/${encodeURIComponent(query)}`), {
    suggestions: [],
    top: [],
    songs: [],
    videos: [],
    albums: [],
    artists: [],
    playlists: [],
  }),

  getSearchSuggestions: (query) => getData(api.get(`/search-suggestions/${encodeURIComponent(query)}`), []),

  getMoodPlaylists: (params) => getData(api.get('/mood-playlists', { params: { params } }), []),

  resolveCollection: (kind, id) => getData(api.get('/resolve', { params: { kind, id } }), {
    title: '',
    tracks: [],
  }),

  getArtistRadio: (artistId) => getData(api.get(`/artist-radio/${artistId}`), []),

  getPlaylist: (playlistId) => getData(api.get(`/playlist/${playlistId}`), []),

  getAlbum: (albumId) => getData(api.get(`/album/${albumId}`), []),

  getWatchPlaylist: (videoId) => getData(api.get(`/watch-playlist/${videoId}`), []),

  getRelated: (videoId) => getData(api.get(`/related/${videoId}`), []),

  getRadio: (videoId) => getData(api.get(`/radio/${videoId}`), []),

  getLyrics: (song, provider = 'auto') => getData(
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
  ),

  getStreamUrl: (videoId, quality = 'high') => {
    return `${API_BASE}/stream/${videoId}?quality=${encodeURIComponent(quality)}`;
  },

  getDownloadUrl: (videoId, title = '') => `${API_BASE}/download/${videoId}?title=${encodeURIComponent(title)}`,

  getFallbackAudioUrl: (songId) => `${API_BASE}/fallback-audio/${encodeURIComponent(songId)}`,
};
