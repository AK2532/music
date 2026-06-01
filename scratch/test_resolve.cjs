const axios = require('axios');

const INNERTUBE_KEY = 'AIzaSyAO_J29T0vS8Gg6wW6_8k';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function innerTubeFetchPlayer(videoId, clientName, clientVersion) {
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
  }
  return null;
}

async function test() {
  const videoId = 'dQw4w9WgXcQ';
  try {
    console.log('[Test] Resolving via ANDROID_VR...');
    const data = await innerTubeFetchPlayer(videoId, 'ANDROID_VR', '1.60.19');
    const url = extractAudioUrlFromPlayerData(data);
    if (!url) {
      console.log('No URL found.');
      return;
    }
    console.log('Resolved URL:', url.slice(0, 80) + '...');

    console.log('[Test] Requesting first 100 bytes via axios...');
    const startTime = Date.now();
    const res = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      headers: {
        'User-Agent': USER_AGENT,
        'Range': 'bytes=0-99',
      },
      timeout: 10000,
    });

    console.log('HTTP Status:', res.status);
    console.log('Headers:', res.headers);

    let bytesReceived = 0;
    res.data.on('data', chunk => {
      bytesReceived += chunk.length;
      console.log(`Received chunk: ${chunk.length} bytes (Total: ${bytesReceived})`);
    });

    res.data.on('end', () => {
      console.log(`Stream finished in ${Date.now() - startTime}ms. Total bytes: ${bytesReceived}`);
    });

    res.data.on('error', err => {
      console.log('Stream error:', err.message);
    });

  } catch (e) {
    console.log('Error:', e.message);
  }
}

test();
