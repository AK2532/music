import YTMusic from 'ytmusic-api';

const ytmusic = new YTMusic();
await ytmusic.initialize();

const res = await ytmusic.search('Paa liya hain pyar tera');
console.log(JSON.stringify(res[0].thumbnails, null, 2));
