import YTMusic from 'ytmusic-api';

const ytmusic = new YTMusic();
await ytmusic.initialize();

const res = await ytmusic.search('Baby Justin Bieber');
console.log(JSON.stringify(res[0].thumbnails, null, 2));
