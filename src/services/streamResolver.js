/**
 * Client-Side Direct YouTube Audio Stream Resolver
 * Fetches stream details from the InnerTube player endpoint and extracts direct googlevideo URLs.
 * Uses trusted client profiles (like TVHTML5 and ANDROID_MUSIC) that return non-ciphered, direct URLs.
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';

const INNER_TUBE_KEY = "AIzaSyAO_J29T0vS8Gg6wW6_8k";

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
      json: async () => {
        if (typeof response.data === 'string') {
          try {
            return JSON.parse(response.data);
          } catch (e) {
            console.error('[streamResolver] JSON parse failed:', e);
            return response.data;
          }
        }
        return response.data;
      },
      text: async () => typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    };
  } else {
    return await fetch(url, options);
  }
}

async function fetchPlayer(videoId, clientName, clientVersion) {
  const url = `https://music.youtube.com/youtubei/v1/player?alt=json&key=${INNER_TUBE_KEY}`;
  
  // Custom headers to resemble native client requests and bypass blocks
  const headers = {
    "Content-Type": "application/json",
    "Origin": "https://music.youtube.com",
    "Referer": "https://music.youtube.com/",
  };
  
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    headers["User-Agent"] = navigator.userAgent;
  }

  const response = await performRequest(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      videoId,
      context: {
        client: {
          clientName,
          clientVersion,
          gl: "US",
          hl: "en",
          utcOffsetMinutes: 0
        },
        user: {
          enableSafetyMode: false
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Player API returned HTTP ${response.status}`);
  }

  return await response.json();
}

function isDirectAudioUrl(url) {
  try {
    const parsed = new URL(url);
    const mime = parsed.searchParams.get('mime') || '';
    const itag = parsed.searchParams.get('itag') || '';
    return mime.startsWith('audio/') && itag !== '18';
  } catch {
    return false;
  }
}

function assertDirectAudioUrl(url, source) {
  if (!isDirectAudioUrl(url)) {
    throw new Error(`${source} returned a non-audio stream URL`);
  }
  return url;
}

function extractAudioUrl(playerData) {
  const formats = [
    ...(playerData.streamingData?.adaptiveFormats || []),
    ...(playerData.streamingData?.formats || [])
  ];

  // Filter for audio-only streams and prefer M4A/MP4 for iOS Safari compatibility.
  const audioFormats = formats
    .filter(f => f.mimeType && f.mimeType.startsWith("audio/"))
    .sort((a, b) => {
      const aMp4 = a.mimeType?.includes("mp4") ? 1 : 0;
      const bMp4 = b.mimeType?.includes("mp4") ? 1 : 0;
      if (aMp4 !== bMp4) return bMp4 - aMp4;
      return (b.bitrate || 0) - (a.bitrate || 0);
    });

  // 1. Try to find a direct URL in audio formats
  for (const format of audioFormats) {
    if (format.url) {
      return format.url;
    }
  }

  // 2. Try extracting URL from signatureCipher (rare for TV/Android clients)
  for (const format of audioFormats) {
    if (format.signatureCipher || format.cipher) {
      const cipher = format.signatureCipher || format.cipher;
      const params = new URLSearchParams(cipher);
      const url = params.get("url");
      if (url) return url;
    }
  }

  return null;
}

export const streamResolver = {
  getStreamUrl: async (videoId, quality = "high") => {
    console.log(`[StreamResolver] Fetching direct stream URL for ${videoId}...`);
    
    // Only use clients that return freely playable CDN URLs.
    // WEB_REMIX (c=WEB) and IOS_MUSIC (c=IOS) produce session-bound URLs that 403.
    // TVHTML5 and ANDROID_* produce c=TVHTML5/c=ANDROID URLs that play without cookies.
    const clients = [
      { name: 'ANDROID_TESTSUITE', clientName: 'ANDROID_TESTSUITE', clientVersion: '1.9'              },
      { name: 'TVHTML5',           clientName: 'TVHTML5',           clientVersion: '7.20230405.01.00' },
      { name: 'ANDROID_MUSIC',     clientName: 'ANDROID_MUSIC',     clientVersion: '6.42.52'          },
      { name: 'ANDROID_EMBEDDED',  clientName: 'ANDROID_EMBEDDED',  clientVersion: '19.13.36'         },
      { name: 'ANDROID_VR',        clientName: 'ANDROID_VR',        clientVersion: '1.60.19'          },
    ];

    for (const client of clients) {
      try {
        const data = await fetchPlayer(videoId, client.clientName, client.clientVersion);
        const url = extractAudioUrl(data);
        if (url) {
          assertDirectAudioUrl(url, `InnerTube/${client.name}`);
          console.log(`[StreamResolver] ${client.name} succeeded for ${videoId}`);
          return url;
        }
      } catch (e) {
        console.warn(`[StreamResolver] ${client.name} failed:`, e.message);
      }
    }

    throw new Error(`Failed to extract audio stream for song ${videoId}`);
  }
};
