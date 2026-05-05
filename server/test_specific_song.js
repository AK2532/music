import YTMusic from 'ytmusic-api';
const ytmusic = new YTMusic();
await ytmusic.initialize();

const results = await ytmusic.searchSongs('Apna Bana Le');
console.log(JSON.stringify(results[0], null, 2));
