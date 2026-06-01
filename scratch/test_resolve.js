const axios = require('axios');

const INNERTUBE_KEY = 'AIzaSyAO_J29T0vS8Gg6wW6_8k';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const INNERTUBE_CLIENTS = [
  { name: 'ANDROID_TESTSUITE', clientName: 'ANDROID_TESTSUITE', clientVersion: '1.9'              },
  { name: 'TVHTML5',           clientName: 'TVHTML5',           clientVersion: '7.20230405.01.00' },
  { name: 'ANDROID_MUSIC',     clientName: 'ANDROID_MUSIC',     clientVersion: '6.42.52'          },
  { name: 'ANDROID_EMBEDDED',  clientName: 'ANDROID_EMBEDDED',  clientVersion: '19.13.36'         },
  { name: 'ANDROID_VR',        clientName: 'ANDROID_VR',        clientVersion: '1.60.19'          },
];

async function innerTubeFetchPlayer(videoId, clientName, clientVersion) {
  console.log(`[Test] Fetching for client: ${clientName}...`);
  const response = await axios.post(
    `https://music.youtube.com/youtubei/v1/player?alt=json&key=${INNERTUBE_KEY}`,
    {
      videoId,
      context: {
        client: { clientName, clientVersion, gl: 'US', hl: 'en', utcOffsetMinutes: 0 },
        user: { enableSafetyMode: false },
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'Origin': 'https://music.youtube.com',
        'Referer': 'https://music.youtube.com/',
      },
      timeout: 10000,
    }
  );
  return response.data;
}

function extractAudioUrlFromPlayerData(data) {
  const formats = [
    ...(data.streamingData?.adaptiveFormats || []),
    ...(data.streamingData?.formats || []),
  ];
  const audioOnly = formats
    .filter(f => f.mimeType?.startsWith('audio/'))
    .sort((a, b) => {
      const aMp4 = a.mimeType?.includes('mp4') ? 1 : 0;
      const bMp4 = b.mimeType?.includes('mp4') ? 1 : 0;
      if (aMp4 !== bMp4) return bMp4 - aMp4;
      return (b.bitrate || 0) - (a.bitrate || 0);
    });

  for (const f of audioOnly) {
    if (f.url) return f.url;
    if (f.signatureCipher || f.cipher) {
      const params = new URLSearchParams(f.signatureCipher || f.cipher);
      const url = params.get('url');
      if (url) return url;
    }
  }
  return null;
}

async function test() {
  const videoId = 'dQw4w9WgXcQ';
  for (const client of INNERTUBE_CLIENTS) {
    try {
      const data = await innerTubeFetchPlayer(videoId, client.clientName, client.clientVersion);
      const url = extractAudioUrlFromPlayerData(data);
      if (url) {
        console.log(`[SUCCESS] Client ${client.name} resolved URL:`, url.slice(0, 100) + '...');
        return;
      }
      console.log(`[FAIL] Client ${client.name} returned no formats.`);
    } catch (e) {
      console.log(`[ERROR] Client ${client.name} failed:`, e.message);
    }
  }
  console.log('All clients failed.');
}

test();
