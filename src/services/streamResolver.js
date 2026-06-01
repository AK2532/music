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
      json: async () => response.data,
      text: async () => typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    };
  } else {
    return await fetch(url, options);
  }
}

async function fetchPlayer(videoId, clientName, clientVersion) {
  const url = `https://music.youtube.com/youtubei/v1/player?alt=json&key=${INNER_TUBE_KEY}`;
  
  // Custom headers to resemble the native client requests
  const headers = {
    "Content-Type": "application/json",
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
          utcOffsetMinutes: -new Date().getTimezoneOffset()
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

function extractAudioUrl(playerData) {
  const formats = [
    ...(playerData.streamingData?.adaptiveFormats || []),
    ...(playerData.streamingData?.formats || [])
  ];

  // Filter for audio-only streams (e.g., audio/mp4, audio/webm)
  const audioFormats = formats.filter(f => f.mimeType && f.mimeType.startsWith("audio/"));
  
  // Sort by bitrate (highest quality first)
  audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  // 1. Try to find a direct URL in audio formats
  for (const format of audioFormats) {
    if (format.url) {
      return format.url;
    }
  }

  // 2. Try deciphering signature cipher if it's there (rare for TV/Android clients)
  for (const format of audioFormats) {
    if (format.signatureCipher || format.cipher) {
      const cipher = format.signatureCipher || format.cipher;
      const params = new URLSearchParams(cipher);
      const url = params.get("url");
      const sig = params.get("s") || params.get("sig");
      const sp = params.get("sp") || "sig";
      
      if (url) {
        // If the signature doesn't need complex deciphering, or as a last-resort fallback
        if (sig) {
          return `${url}&${sp}=${encodeURIComponent(sig)}`;
        }
        return url;
      }
    }
  }

  // 3. Fallback to any format with a direct URL (e.g. low quality video format)
  for (const format of formats) {
    if (format.url) {
      return format.url;
    }
  }

  return null;
}

export const streamResolver = {
  getStreamUrl: async (videoId, quality = "high") => {
    console.log(`[StreamResolver] Fetching direct stream URL for ${videoId}...`);
    
    // 1. First attempt: TVHTML5 (most reliable for direct browser/webview playback, bypasses signature cipher)
    try {
      const data = await fetchPlayer(videoId, "TVHTML5", "7.20230405.01.00");
      const url = extractAudioUrl(data);
      if (url) {
        console.log(`[StreamResolver] Successfully resolved direct stream URL via TVHTML5 for ${videoId}`);
        return url;
      }
    } catch (e) {
      console.warn(`[StreamResolver] TVHTML5 resolver failed:`, e.message);
    }

    // 2. Second attempt: ANDROID_MUSIC (fallback)
    try {
      const data = await fetchPlayer(videoId, "ANDROID_MUSIC", "6.02.52");
      const url = extractAudioUrl(data);
      if (url) {
        console.log(`[StreamResolver] Successfully resolved direct stream URL via ANDROID_MUSIC for ${videoId}`);
        return url;
      }
    } catch (e) {
      console.warn(`[StreamResolver] ANDROID_MUSIC resolver failed:`, e.message);
    }

    // 3. Third attempt: standard web player context
    try {
      const data = await fetchPlayer(videoId, "WEB_REMIX", "1.20241022.01.00");
      const url = extractAudioUrl(data);
      if (url) {
        console.log(`[StreamResolver] Successfully resolved direct stream URL via WEB_REMIX for ${videoId}`);
        return url;
      }
    } catch (e) {
      console.error(`[StreamResolver] WEB_REMIX resolver failed:`, e.message);
    }

    // Return a last-resort fallback or throw
    throw new Error(`Failed to extract audio stream for song ${videoId}`);
  }
};
