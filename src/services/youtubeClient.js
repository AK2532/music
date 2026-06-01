/**
 * Client-Side YouTube Music Scraping Client
 * Replaces the Express server's ytmusic-api dependency by executing InnerTube API calls
 * directly in the browser/Capacitor environment.
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';

// Helper function to perform requests natively in Capacitor (bypassing CORS)
// or using standard fetch in browsers.
async function performRequest(url, options = {}) {
  if (Capacitor.isNativePlatform()) {
    const method = options.method || 'GET';
    const capOptions = {
      url,
      method,
      headers: options.headers || {},
    };
    
    if (options.body) {
      if (typeof options.body === 'string') {
        try {
          capOptions.data = JSON.parse(options.body);
        } catch (e) {
          capOptions.data = options.body;
        }
      } else {
        capOptions.data = options.body;
      }
    }
    
    const response = await CapacitorHttp.request(capOptions);
    
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.data,
      text: async () => typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    };
  } else {
    return await fetch(url, options);
  }
}

// Helper: traverse JSON keys dynamically (matches ytmusic-api's parser logic)
const traverse = (data, ...keys) => {
  const again = (data2, key, deadEnd = false) => {
    const res = [];
    if (data2 instanceof Object && key in data2) {
      res.push(data2[key]);
      if (deadEnd) return res.length === 1 ? res[0] : res;
    }
    if (data2 instanceof Array) {
      res.push(...data2.map((v) => again(v, key)).flat());
    } else if (data2 instanceof Object) {
      res.push(
        ...Object.keys(data2).map((k) => again(data2[k], key)).flat()
      );
    }
    return res.length === 1 ? res[0] : res;
  };
  let value = data;
  const lastKey = keys.at(-1);
  for (const key of keys) {
    value = again(value, key, lastKey === key);
  }
  return value;
};

const traverseList = (data, ...keys) => {
  return [traverse(data, ...keys)].flat().filter(v => v !== undefined && v !== null);
};

const traverseString = (data, ...keys) => {
  return traverseList(data, ...keys).at(0) || "";
};

// Filters to identify items
const isTitle = (data) => traverseString(data, "musicVideoType").startsWith("MUSIC_VIDEO_TYPE_");
const isArtist = (data) => ["MUSIC_PAGE_TYPE_USER_CHANNEL", "MUSIC_PAGE_TYPE_ARTIST"].includes(traverseString(data, "pageType"));
const isAlbum = (data) => traverseString(data, "pageType") === "MUSIC_PAGE_TYPE_ALBUM";
const isDuration = (data) => traverseString(data, "text").match(/(\d{1,2}:)?\d{1,2}:\d{1,2}/);

// Parsers
class Parser {
  static parseDuration(time) {
    if (!time) return null;
    const parts = time.split(":").reverse().map((n) => +n);
    const seconds = parts[0] || 0;
    const minutes = parts[1] || 0;
    const hours = parts[2] || 0;
    return seconds + minutes * 60 + hours * 60 * 60;
  }

  static parseHomeSection(data) {
    const pageType = traverseString(data, "contents", "title", "browseEndpoint", "pageType");
    const playlistId = traverseString(data, "navigationEndpoint", "watchPlaylistEndpoint", "playlistId");
    
    const items = traverseList(data, "contents").map((item) => {
      switch (pageType) {
        case "MUSIC_PAGE_TYPE_ALBUM":
          return AlbumParser.parseHomeSection(item);
        case "MUSIC_PAGE_TYPE_PLAYLIST":
          return PlaylistParser.parseHomeSection(item);
        case "":
          if (playlistId) {
            return PlaylistParser.parseHomeSection(item);
          } else {
            return SongParser.parseHomeSection(item);
          }
        default:
          // Fallback parsing based on hints in the object
          if (traverseString(item, "playlistId") || traverseString(item, "overlay", "playlistId")) {
            return PlaylistParser.parseHomeSection(item);
          } else if (traverseString(item, "albumId") || traverseString(item, "browseId")) {
            return AlbumParser.parseHomeSection(item);
          }
          return SongParser.parseHomeSection(item);
      }
    }).filter(Boolean);

    return {
      title: traverseString(data, "header", "title", "text"),
      items
    };
  }
}

class PlaylistParser {
  static parse(data, playlistId) {
    const artist = traverse(data, "tabs", "straplineTextOne");
    const subtitleRuns = traverseList(data, "tabs", "secondSubtitle", "text");
    const videoCountText = subtitleRuns.at(2) || subtitleRuns.at(0) || "0";
    const videoCount = parseInt(videoCountText.split(" ").at(0).replaceAll(",", ""), 10) || 0;
    
    return {
      type: "PLAYLIST",
      playlistId,
      name: traverseString(data, "tabs", "title", "text"),
      artist: {
        name: traverseString(artist, "text") || "Various Artists",
        artistId: traverseString(artist, "browseId") || null
      },
      videoCount,
      thumbnails: traverseList(data, "tabs", "thumbnails")
    };
  }

  static parseSearchResult(item) {
    const columns = traverseList(item, "flexColumns", "runs").flat();
    const title = columns[0];
    const artist = columns.find(isArtist) || columns[3];
    return {
      type: "playlist",
      playlistId: traverseString(item, "overlay", "playlistId") || traverseString(item, "playlistId"),
      title: traverseString(title, "text"),
      artist: traverseString(artist, "text") || "Various Artists",
      thumbnails: traverseList(item, "thumbnails")
    };
  }

  static parseArtistFeaturedOn(item, artistBasic) {
    return {
      type: "playlist",
      playlistId: traverseString(item, "navigationEndpoint", "browseId"),
      title: traverseString(item, "runs", "text"),
      artist: artistBasic.name,
      thumbnails: traverseList(item, "thumbnails")
    };
  }

  static parseHomeSection(item) {
    const artist = traverse(item, "subtitle", "runs");
    return {
      type: "playlist",
      playlistId: traverseString(item, "navigationEndpoint", "playlistId") || traverseString(item, "playlistId"),
      title: traverseString(item, "runs", "text") || traverseString(item, "title", "text"),
      artist: traverseString(artist, "text") || "Various Artists",
      thumbnails: traverseList(item, "thumbnails")
    };
  }
}

class SongParser {
  static parse(data) {
    return {
      type: "SONG",
      videoId: traverseString(data, "videoDetails", "videoId"),
      name: traverseString(data, "videoDetails", "title"),
      artist: {
        name: traverseString(data, "author"),
        artistId: traverseString(data, "videoDetails", "channelId")
      },
      duration: +traverseString(data, "videoDetails", "lengthSeconds"),
      thumbnails: traverseList(data, "videoDetails", "thumbnails"),
      formats: traverseList(data, "streamingData", "formats"),
      adaptiveFormats: traverseList(data, "streamingData", "adaptiveFormats")
    };
  }

  static parseSearchResult(item) {
    const columns = traverseList(item, "flexColumns", "runs");
    const title = columns[0];
    const artist = columns.find(isArtist) || columns[3];
    const album = columns.find(isAlbum) ?? null;
    const duration = columns.find(isDuration);
    
    return {
      type: "song",
      videoId: traverseString(item, "playlistItemData", "videoId") || traverseString(item, "videoId"),
      title: traverseString(title, "text"),
      artist: traverseString(artist, "text") || "Unknown Artist",
      artists: [{ name: traverseString(artist, "text") || "Unknown Artist", id: traverseString(artist, "browseId") || null }],
      album: album ? {
        name: traverseString(album, "text"),
        id: traverseString(album, "browseId")
      } : null,
      duration: duration?.text || null,
      durationSeconds: Parser.parseDuration(duration?.text),
      thumbnails: traverseList(item, "thumbnails")
    };
  }

  static parseArtistSong(item, artistBasic) {
    const columns = traverseList(item, "flexColumns", "runs").flat();
    const title = columns.find(isTitle);
    const album = columns.find(isAlbum);
    const duration = columns.find(isDuration);
    return {
      type: "song",
      videoId: traverseString(item, "playlistItemData", "videoId"),
      title: traverseString(title, "text"),
      artist: artistBasic.name,
      artists: [artistBasic],
      album: album ? {
        name: traverseString(album, "text"),
        id: traverseString(album, "browseId")
      } : null,
      duration: duration?.text || null,
      durationSeconds: Parser.parseDuration(duration?.text),
      thumbnails: traverseList(item, "thumbnails")
    };
  }

  static parseArtistTopSong(item, artistBasic) {
    const columns = traverseList(item, "flexColumns", "runs").flat();
    const title = columns.find(isTitle) || columns[0];
    const album = columns.find(isAlbum);
    return {
      type: "song",
      videoId: traverseString(item, "playlistItemData", "videoId") || traverseString(item, "videoId"),
      title: traverseString(title, "text"),
      artist: artistBasic.name,
      artists: [artistBasic],
      album: album ? {
        name: traverseString(album, "text"),
        id: traverseString(album, "browseId")
      } : null,
      duration: null,
      durationSeconds: null,
      thumbnails: traverseList(item, "thumbnails")
    };
  }

  static parseAlbumSong(item, artistBasic, albumBasic, thumbnails) {
    const title = traverseList(item, "flexColumns", "runs").find(isTitle) || traverseList(item, "flexColumns", "runs").flat()[0];
    const duration = traverseList(item, "fixedColumns", "runs").find(isDuration);
    return {
      type: "song",
      videoId: traverseString(item, "playlistItemData", "videoId") || traverseString(item, "videoId"),
      title: traverseString(title, "text"),
      artist: artistBasic.name,
      artists: [artistBasic],
      album: albumBasic,
      duration: duration?.text || null,
      durationSeconds: Parser.parseDuration(duration?.text),
      thumbnails: thumbnails || traverseList(item, "thumbnails")
    };
  }

  static parseHomeSection(item) {
    return SongParser.parseSearchResult(item);
  }
}

class AlbumParser {
  static parse(data, albumId) {
    const albumBasic = {
      albumId,
      name: traverseString(data, "tabs", "title", "text")
    };
    const artistData = traverse(data, "tabs", "straplineTextOne", "runs");
    const artistBasic = {
      artistId: traverseString(artistData, "browseId") || null,
      name: traverseString(artistData, "text") || "Unknown Artist"
    };
    const thumbnails = traverseList(data, "background", "thumbnails");
    const rawSongs = traverseList(data, "musicResponsiveListItemRenderer");
    const songs = rawSongs.map(
      (item) => SongParser.parseAlbumSong(item, artistBasic, albumBasic, thumbnails)
    );

    const yearText = traverseList(data, "tabs", "subtitle", "text").at(-1) || "";
    const yearMatch = yearText.match(/\b\d{4}\b/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : null;

    return {
      type: "ALBUM",
      albumId,
      playlistId: traverseString(data, "musicPlayButtonRenderer", "playlistId"),
      artist: artistBasic,
      title: albumBasic.name,
      year,
      thumbnails,
      songs
    };
  }

  static parseSearchResult(item) {
    const columns = traverseList(item, "flexColumns", "runs").flat();
    const title = columns[0];
    const artist = columns.find(isArtist) || columns[3];
    const playlistId = traverseString(item, "overlay", "playlistId") || traverseString(item, "thumbnailOverlay", "playlistId");
    const yearText = columns.at(-1)?.text || "";
    const yearMatch = yearText.match(/\b\d{4}\b/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : null;

    return {
      type: "album",
      albumId: traverseList(item, "browseId").at(-1),
      playlistId,
      artist: traverseString(artist, "text") || "Unknown Artist",
      year,
      title: traverseString(title, "text"),
      thumbnails: traverseList(item, "thumbnails")
    };
  }

  static parseArtistAlbum(item, artistBasic) {
    const yearText = traverseList(item, "subtitle", "text").at(-1) || "";
    const yearMatch = yearText.match(/\b\d{4}\b/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : null;

    return {
      type: "album",
      albumId: traverseList(item, "browseId").at(-1),
      playlistId: traverseString(item, "thumbnailOverlay", "playlistId"),
      title: traverseString(item, "title", "text"),
      artist: artistBasic.name,
      year,
      thumbnails: traverseList(item, "thumbnails")
    };
  }

  static parseArtistTopAlbum(item, artistBasic) {
    const yearText = traverseList(item, "subtitle", "text").at(-1) || "";
    const yearMatch = yearText.match(/\b\d{4}\b/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : null;

    return {
      type: "album",
      albumId: traverseList(item, "browseId").at(-1),
      playlistId: traverseString(item, "musicPlayButtonRenderer", "playlistId"),
      title: traverseString(item, "title", "text"),
      artist: artistBasic.name,
      year,
      thumbnails: traverseList(item, "thumbnails")
    };
  }

  static parseHomeSection(item) {
    const artist = traverse(item, "subtitle", "runs").at(-1);
    return {
      type: "album",
      albumId: traverseString(item, "title", "browseId"),
      playlistId: traverseString(item, "thumbnailOverlay", "playlistId"),
      title: traverseString(item, "title", "text"),
      artist: traverseString(artist, "text") || "Various Artists",
      year: null,
      thumbnails: traverseList(item, "thumbnails")
    };
  }
}

class VideoParser {
  static parseSearchResult(item) {
    const columns = traverseList(item, "flexColumns", "runs").flat();
    const title = columns[0];
    const artist = columns.find(isArtist) || columns[1];
    const duration = columns.find(isDuration);
    return {
      type: "video",
      videoId: traverseString(item, "playNavigationEndpoint", "videoId") || traverseString(item, "videoId"),
      title: traverseString(title, "text"),
      artist: traverseString(artist, "text") || "Unknown Artist",
      duration: duration?.text || null,
      durationSeconds: Parser.parseDuration(duration?.text),
      thumbnails: traverseList(item, "thumbnails")
    };
  }

  static parseArtistTopVideo(item, artistBasic) {
    return {
      type: "video",
      videoId: traverseString(item, "videoId"),
      title: traverseString(item, "runs", "text"),
      artist: artistBasic.name,
      duration: null,
      thumbnails: traverseList(item, "thumbnails")
    };
  }

  static parsePlaylistVideo(item) {
    const flexColumns = traverseList(item, "flexColumns", "runs").flat();
    const fixedcolumns = traverseList(item, "fixedColumns", "runs").flat();
    const title = flexColumns.find(isTitle) || flexColumns[0];
    const artist = flexColumns.find(isArtist) || flexColumns[1];
    const duration = fixedcolumns.find(isDuration);
    const videoId1 = traverseString(item, "playNavigationEndpoint", "videoId");
    
    let videoId2 = null;
    const thumbUrl = traverseList(item, "thumbnails")[0]?.url || "";
    const match = thumbUrl.match(/https:\/\/i\.ytimg\.com\/vi\/(.+)\//);
    if (match) videoId2 = match[1];

    const videoId = videoId1 || videoId2;
    if (!videoId) return null;

    return {
      type: "video",
      videoId,
      title: traverseString(title, "text"),
      artist: traverseString(artist, "text") || "Unknown Artist",
      duration: duration?.text || null,
      durationSeconds: Parser.parseDuration(duration?.text),
      thumbnails: traverseList(item, "thumbnails")
    };
  }
}

class ArtistParser {
  static parse(data, artistId) {
    const artistBasic = {
      artistId,
      name: traverseString(data, "header", "title", "text") || "Unknown Artist"
    };

    const carouselShelves = traverseList(data, "musicCarouselShelfRenderer");
    
    // Top songs
    const topSongs = traverseList(data, "musicShelfRenderer", "contents").map(
      (item) => SongParser.parseArtistTopSong(item, artistBasic)
    );

    // Top albums / singles / videos
    const topAlbums = (carouselShelves.at(0)?.contents || []).map(
      (item) => AlbumParser.parseArtistTopAlbum(item, artistBasic)
    );
    const topSingles = (carouselShelves.at(1)?.contents || []).map(
      (item) => AlbumParser.parseArtistTopAlbum(item, artistBasic)
    );
    const topVideos = (carouselShelves.at(2)?.contents || []).map(
      (item) => VideoParser.parseArtistTopVideo(item, artistBasic)
    );
    const featuredOn = (carouselShelves.at(3)?.contents || []).map(
      (item) => PlaylistParser.parseArtistFeaturedOn(item, artistBasic)
    );
    const similarArtists = (carouselShelves.at(4)?.contents || []).map(
      (item) => this.parseSimilarArtists(item)
    );

    return {
      type: "ARTIST",
      artistId,
      name: artistBasic.name,
      thumbnails: traverseList(data, "header", "thumbnails"),
      topSongs,
      topAlbums,
      topSingles,
      topVideos,
      featuredOn,
      similarArtists
    };
  }

  static parseSearchResult(item) {
    const columns = traverseList(item, "flexColumns", "runs").flat();
    const title = columns[0];
    return {
      type: "artist",
      artistId: traverseString(item, "browseId"),
      title: traverseString(title, "text"),
      thumbnails: traverseList(item, "thumbnails")
    };
  }

  static parseSimilarArtists(item) {
    return {
      type: "artist",
      artistId: traverseString(item, "browseId"),
      title: traverseString(item, "runs", "text") || traverseString(item, "title", "text"),
      thumbnails: traverseList(item, "thumbnails")
    };
  }
}

class SearchParser {
  static parse(item) {
    const flexColumns = traverseList(item, "flexColumns");
    const type = traverseList(flexColumns[1], "runs", "text").at(0);
    const parsers = {
      Song: SongParser.parseSearchResult,
      Video: VideoParser.parseSearchResult,
      Artist: ArtistParser.parseSearchResult,
      EP: AlbumParser.parseSearchResult,
      Single: AlbumParser.parseSearchResult,
      Album: AlbumParser.parseSearchResult,
      Playlist: PlaylistParser.parseSearchResult
    };
    if (parsers[type]) {
      return parsers[type](item);
    }
    return null;
  }
}

// Global dynamic YouTube configuration (obtained via HTML parsing)
let config = null;

async function getClientConfig() {
  if (config) return config;
  try {
    const headers = {
      "Accept-Language": "en-US,en;q=0.9",
    };
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      headers["User-Agent"] = navigator.userAgent;
    }
    const res = await performRequest("https://music.youtube.com/", { headers });
    const html = await res.text();
    const setConfigs = html.match(/ytcfg\.set\(.*?\);/g) || [];
    let parsedConfig = {};
    for (const c of setConfigs) {
      try {
        const jsonStr = c.substring(10, c.length - 2);
        const parsed = JSON.parse(jsonStr);
        parsedConfig = { ...parsedConfig, ...parsed };
      } catch (e) {}
    }
    
    config = {
      apiKey: parsedConfig.INNERTUBE_API_KEY || "AIzaSyAO_J29T0vS8Gg6wW6_8k",
      clientName: parsedConfig.INNERTUBE_CLIENT_NAME || "WEB_REMIX",
      clientVersion: parsedConfig.INNERTUBE_CLIENT_VERSION || "1.20241022.01.00",
      visitorData: parsedConfig.VISITOR_DATA || "",
      gl: parsedConfig.GL || "US",
      hl: parsedConfig.HL || "en",
    };
    return config;
  } catch (err) {
    console.error("Failed to parse YouTube configs client-side, using defaults:", err);
    config = {
      apiKey: "AIzaSyAO_J29T0vS8Gg6wW6_8k",
      clientName: "WEB_REMIX",
      clientVersion: "1.20241022.01.00",
      visitorData: "",
      gl: "US",
      hl: "en",
    };
    return config;
  }
}

async function constructRequest(endpoint, body = {}, query = {}) {
  const cfg = await getClientConfig();
  
  const headers = {
    "Content-Type": "application/json",
    "X-Goog-Visitor-Id": cfg.visitorData,
    "X-YouTube-Client-Name": "67", // 67 corresponds to WEB_REMIX
    "X-YouTube-Client-Version": cfg.clientVersion,
  };
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    headers["User-Agent"] = navigator.userAgent;
  }
  
  const searchParams = new URLSearchParams({
    ...query,
    alt: "json",
    key: cfg.apiKey
  });
  
  const url = `https://music.youtube.com/youtubei/v1/${endpoint}?${searchParams.toString()}`;
  
  const response = await performRequest(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      context: {
        capabilities: {},
        client: {
          clientName: cfg.clientName,
          clientVersion: cfg.clientVersion,
          gl: cfg.gl,
          hl: cfg.hl,
          utcOffsetMinutes: -new Date().getTimezoneOffset()
        },
        user: {
          enableSafetyMode: false
        }
      },
      ...body
    })
  });
  
  if (!response.ok) {
    throw new Error(`InnerTube HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// Public API wrapper
export const youtubeClient = {
  getSearchSuggestions: async (query) => {
    try {
      const data = await constructRequest("music/get_search_suggestions", {
        input: query
      });
      return traverseList(data, "query");
    } catch (e) {
      console.error("suggestions fail:", e);
      return [];
    }
  },

  search: async (query) => {
    try {
      const data = await constructRequest("search", {
        query,
        params: null
      });
      return traverseList(data, "musicResponsiveListItemRenderer")
        .map(SearchParser.parse)
        .filter(Boolean);
    } catch (e) {
      console.error("search fail:", e);
      return [];
    }
  },

  searchSongs: async (query) => {
    try {
      const data = await constructRequest("search", {
        query,
        params: "Eg-KAQwIARAAGAAgACgAMABqChAEEAMQCRAFEAo%"
      });
      return traverseList(data, "musicResponsiveListItemRenderer")
        .map(SongParser.parseSearchResult)
        .filter(Boolean);
    } catch (e) {
      console.error("searchSongs fail:", e);
      return [];
    }
  },

  searchVideos: async (query) => {
    try {
      const data = await constructRequest("search", {
        query,
        params: "Eg-KAQwIABABGAAgACgAMABqChAEEAMQCRAFEAo%"
      });
      return traverseList(data, "musicResponsiveListItemRenderer")
        .map(VideoParser.parseSearchResult)
        .filter(Boolean);
    } catch (e) {
      console.error("searchVideos fail:", e);
      return [];
    }
  },

  searchArtists: async (query) => {
    try {
      const data = await constructRequest("search", {
        query,
        params: "Eg-KAQwIABAAGAAgASgAMABqChAEEAMQCRAFEAo%"
      });
      return traverseList(data, "musicResponsiveListItemRenderer")
        .map(ArtistParser.parseSearchResult)
        .filter(Boolean);
    } catch (e) {
      console.error("searchArtists fail:", e);
      return [];
    }
  },

  searchAlbums: async (query) => {
    try {
      const data = await constructRequest("search", {
        query,
        params: "Eg-KAQwIABAAGAEgACgAMABqChAEEAMQCRAFEAo%"
      });
      return traverseList(data, "musicResponsiveListItemRenderer")
        .map(AlbumParser.parseSearchResult)
        .filter(Boolean);
    } catch (e) {
      console.error("searchAlbums fail:", e);
      return [];
    }
  },

  searchPlaylists: async (query) => {
    try {
      const data = await constructRequest("search", {
        query,
        params: "Eg-KAQwIABAAGAAgACgBMABqChAEEAMQCRAFEAo%"
      });
      return traverseList(data, "musicResponsiveListItemRenderer")
        .map(PlaylistParser.parseSearchResult)
        .filter(Boolean);
    } catch (e) {
      console.error("searchPlaylists fail:", e);
      return [];
    }
  },

  getSong: async (videoId) => {
    const data = await constructRequest("player", { videoId });
    return SongParser.parse(data);
  },

  getUpNexts: async (videoId) => {
    const data = await constructRequest("next", {
      videoId,
      playlistId: `RDAMVM${videoId}`,
      isAudioOnly: true
    });
    
    const panel = traverse(data, "playlistPanelRenderer");
    const contents = traverseList(panel, "contents");
    
    return contents.map((item) => {
      const p = item.playlistPanelVideoRenderer;
      if (!p) return null;
      
      const vId = p.videoId;
      const title = traverseString(p, "title", "runs", "text") || p.title?.runs[0]?.text || "Unknown";
      const artist = traverseString(p, "shortBylineText", "runs", "text") || p.shortBylineText?.runs[0]?.text || "Unknown";
      const duration = p.lengthText?.runs[0]?.text || "Unknown";
      
      const thumbs = traverseList(p, "thumbnail", "thumbnails");
      const thumbnail = thumbs.at(-1)?.url || thumbs.at(0)?.url || "";
      
      return {
        type: "song",
        id: vId,
        videoId: vId,
        title,
        artist,
        artists: [{ name: artist, id: null }],
        duration,
        durationSeconds: Parser.parseDuration(duration),
        thumbnail
      };
    }).filter(Boolean);
  },

  getLyrics: async (videoId) => {
    try {
      const data = await constructRequest("next", { videoId });
      const tabs = traverseList(data, "tabs", "tabRenderer");
      const lyricsTab = tabs.find(t => traverseString(t, "title") === "Lyrics" || traverse(t, "browseId"));
      
      if (!lyricsTab) return null;
      const browseId = traverse(lyricsTab, "browseId");
      if (!browseId) return null;
      
      const lyricsData = await constructRequest("browse", { browseId });
      const text = traverseString(lyricsData, "description", "runs", "text") || traverseString(lyricsData, "runs", "text");
      return text ? text.replaceAll("\r", "").split("\n").filter((v) => !!v).join("\n") : null;
    } catch (e) {
      console.warn("lyrics parse fail:", e.message);
      return null;
    }
  },

  getArtist: async (artistId) => {
    const data = await constructRequest("browse", { browseId: artistId });
    return ArtistParser.parse(data, artistId);
  },

  getArtistSongs: async (artistId) => {
    const artistData = await constructRequest("browse", { browseId: artistId });
    const shelves = traverseList(artistData, "musicShelfRenderer");
    const browseToken = traverse(shelves[0], "title", "browseId");
    
    if (!browseToken || browseToken instanceof Array) {
      // Fallback: parse whatever songs are on the main artist page
      const name = traverseString(artistData, "header", "title", "text") || "Artist";
      const contents = traverseList(artistData, "musicShelfRenderer", "contents");
      return contents.map(s => SongParser.parseArtistSong(s, { artistId, name })).filter(Boolean);
    }
    
    const songsData = await constructRequest("browse", { browseId: browseToken });
    const continueToken = traverse(songsData, "continuation");
    
    let moreSongsData = null;
    if (continueToken && typeof continueToken === 'string') {
      try {
        moreSongsData = await constructRequest("browse", {}, { continuation: continueToken });
      } catch (err) {}
    }
    
    const name = traverseString(artistData, "header", "title", "text") || "Artist";
    const list = [
      ...traverseList(songsData, "musicResponsiveListItemRenderer"),
      ...(moreSongsData ? traverseList(moreSongsData, "musicResponsiveListItemRenderer") : [])
    ];
    
    return list.map(
      (s) => SongParser.parseArtistSong(s, { artistId, name })
    ).filter(Boolean);
  },

  getArtistAlbums: async (artistId) => {
    const artistData = await constructRequest("browse", { browseId: artistId });
    const carousels = traverseList(artistData, "musicCarouselShelfRenderer");
    const albumCarousel = carousels[0];
    const browseBody = traverse(albumCarousel, "moreContentButton", "browseEndpoint");
    
    if (!browseBody) {
      // Parse direct albums listed
      const name = traverseString(artistData, "header", "title", "text") || "Artist";
      const contents = traverseList(albumCarousel, "contents");
      return contents.map(item => AlbumParser.parseArtistAlbum(item, { artistId, name })).filter(Boolean);
    }
    
    const albumsData = await constructRequest("browse", browseBody);
    const list = traverseList(albumsData, "musicTwoRowItemRenderer");
    const name = traverseString(albumsData, "header", "runs", "text") || "Artist";
    
    return list.map(
      (item) => AlbumParser.parseArtistAlbum(item, { artistId, name })
    ).filter(Boolean);
  },

  getAlbum: async (albumId) => {
    const data = await constructRequest("browse", { browseId: albumId });
    return AlbumParser.parse(data, albumId);
  },

  getPlaylist: async (playlistId) => {
    let browseId = playlistId;
    if (playlistId.startsWith("PL") && !playlistId.startsWith("VL")) {
      browseId = "VL" + playlistId;
    }
    const data = await constructRequest("browse", { browseId });
    return PlaylistParser.parse(data, browseId);
  },

  getPlaylistVideos: async (playlistId) => {
    let browseId = playlistId;
    if (playlistId.startsWith("PL") && !playlistId.startsWith("VL")) {
      browseId = "VL" + playlistId;
    }
    const playlistData = await constructRequest("browse", { browseId });
    const songs = traverseList(
      playlistData,
      "musicPlaylistShelfRenderer",
      "musicResponsiveListItemRenderer"
    );
    
    let continuation = traverse(playlistData, "continuation");
    if (continuation instanceof Array) {
      continuation = continuation[0];
    }
    
    let iterations = 0;
    while (continuation && typeof continuation === 'string' && iterations < 5) {
      try {
        const songsData = await constructRequest("browse", {}, { continuation });
        songs.push(...traverseList(songsData, "musicResponsiveListItemRenderer"));
        continuation = traverse(songsData, "continuation");
        if (continuation instanceof Array) continuation = continuation[0];
        iterations++;
      } catch (err) {
        break;
      }
    }
    
    return songs.map(VideoParser.parsePlaylistVideo).filter(Boolean);
  },

  getHomeSections: async () => {
    const data = await constructRequest("browse", {
      browseId: "FEmusic_home"
    });
    
    const sections = traverseList(data, "sectionListRenderer", "contents");
    let continuation = traverseString(data, "continuation");
    
    let iterations = 0;
    while (continuation && iterations < 2) {
      try {
        const data2 = await constructRequest("browse", {}, { continuation });
        sections.push(...traverseList(data2, "sectionListContinuation", "contents"));
        continuation = traverseString(data2, "continuation");
        iterations++;
      } catch (err) {
        break;
      }
    }
    
    return sections.map(Parser.parseHomeSection).filter(s => s.items && s.items.length > 0);
  }
};
