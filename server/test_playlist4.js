import YTMusic from 'ytmusic-api';
const ytmusic = new YTMusic();
await ytmusic.initialize();

const id = 'VLRDCLAK5uy_nhLiD_PquxQnzA35YpoaaAUv2ikZuYFgw';
try {
    const videos = await ytmusic.getPlaylistVideos(id);
    console.log(`Videos length: ${videos?.length}`);
    if (videos && videos.length > 0) {
        console.log('First video:', JSON.stringify(videos[0], null, 2));
    }
} catch (e) {
    console.error('Failed getPlaylistVideos:', e.message);
}
