import YTMusic from 'ytmusic-api';
const ytmusic = new YTMusic();
await ytmusic.initialize();

const id = 'VLRDCLAK5uy_nhLiD_PquxQnzA35YpoaaAUv2ikZuYFgw';
try {
    const data = await ytmusic.getPlaylist(id);
    console.log(Object.keys(data));
    console.log(JSON.stringify(data, null, 2).substring(0, 1000));
} catch (e) {
    console.error('Failed:', e.message);
}
