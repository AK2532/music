import YTMusic from 'ytmusic-api';
const ytmusic = new YTMusic();
await ytmusic.initialize();

async function testPlaylist(id) {
    try {
        console.log(`Testing with ID: ${id}`);
        const data = await ytmusic.getPlaylist(id);
        console.log('Success! Tracks:', data.tracks?.length || data.songs?.length || data.content?.length);
    } catch (e) {
        console.error('Failed:', e.message);
    }
}

const id = 'RDCLAK5uy_nhLiD_PquxQnzA35YpoaaAUv2ikZuYFgw';
await testPlaylist(id);
await testPlaylist('VL' + id);
await testPlaylist(id.replace(/^VL/, ''));
