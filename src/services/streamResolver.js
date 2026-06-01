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

  // Filter for audio-only streams and prefer M4A/MP4 for iOS Safari compatibility.
  const audioFormats = formats.filter(f => f.mimeType && f.mimeType.startsWith("audio/"));
  
  audioFormats.sort((a, b) => {
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
      const sig = params.get("s") || params.get("sig");
      const sp = params.get("sp") || "sig";
      
      if (url) {
        if (sig) {
          return `${url}&${sp}=${encodeURIComponent(sig)}`;
        }
        return url;
      }
    }
  }

  // IMPORTANT: Do NOT fall back to video formats (itag=18, mime=video/mp4, c=WEB).
  // Video-format CDN URLs require a browser session cookie — they always 403 when
  // the audio element requests them directly without that session.
  // Return null so the caller tries a different InnerTube client.
  return null;
}


export const streamResolver = {
  getStreamUrl: async (videoId, quality = "high") => {
    console.log(`[StreamResolver] Fetching direct stream URL for ${videoId}...`);
    
    // Only use clients that return freely playable CDN URLs.
    // WEB_REMIX (c=WEB) and IOS_MUSIC (c=IOS) produce session-bound URLs that 403.
    // TVHTML5 and ANDROID_* produce c=TVHTML5/c=ANDROID URLs that play without cookies.
    
    // 1. TVHTML5 (most reliable — TV clients get direct, non-ciphered audio URLs)
    try {
      const data = await fetchPlayer(videoId, "TVHTML5", "7.20230405.01.00");
      const url = extractAudioUrl(data);
      if (url) {
        console.log(`[StreamResolver] TVHTML5 succeeded for ${videoId}`);
        return url;
      }
    } catch (e) {
      console.warn(`[StreamResolver] TVHTML5 failed:`, e.message);
    }

    // 2. ANDROID_MUSIC (reliable fallback)
    try {
      const data = await fetchPlayer(videoId, "ANDROID_MUSIC", "6.42.52");
      const url = extractAudioUrl(data);
      if (url) {
        console.log(`[StreamResolver] ANDROID_MUSIC succeeded for ${videoId}`);
        return url;
      }
    } catch (e) {
      console.warn(`[StreamResolver] ANDROID_MUSIC failed:`, e.message);
    }

    // 3. ANDROID_EMBEDDED (third option)
    try {
      const data = await fetchPlayer(videoId, "ANDROID_EMBEDDED", "19.13.36");
      const url = extractAudioUrl(data);
      if (url) {
        console.log(`[StreamResolver] ANDROID_EMBEDDED succeeded for ${videoId}`);
        return url;
      }
    } catch (e) {
      console.error(`[StreamResolver] ANDROID_EMBEDDED failed:`, e.message);
    }

    // All clients failed
    throw new Error(`Failed to extract audio stream for song ${videoId}`);
  }
};
