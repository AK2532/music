import YTMusic from 'ytmusic-api';

const ytmusic = new YTMusic();
await ytmusic.initialize();

const testId = 'PL0m_RB_7C_lxeT_3vL8X0Z5z0dZ0Z0Z0Z'; // Dummy or real ID if I had one

console.log('Testing getPlaylist...');
try {
    const data = await ytmusic.getPlaylist('VLRDCLAK5uy_mXn7f-x9Q-y_l-Qn1Y8v5-q8z8n0Q'); // Pop hits
    console.log('Playlist name:', data.name || data.title);
    console.log('Keys in playlist data:', Object.keys(data));
} catch (e) {
    console.log('getPlaylist failed:', e.message);
}

console.log('Testing getPlaylistVideos...');
try {
    const videos = await ytmusic.getPlaylistVideos('VLRDCLAK5uy_mXn7f-x9Q-y_l-Qn1Y8v5-q8z8n0Q');
    console.log('Found', videos.length, 'videos');
} catch (e) {
    console.log('getPlaylistVideos failed:', e.message);
}
