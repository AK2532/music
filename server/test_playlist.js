import YTMusic from 'ytmusic-api';
const ytmusic = new YTMusic();
await ytmusic.initialize();

const playlistId = 'RDCLAK5uy_lZ-mUvE7f2E2h6mN-vV6N_9V1U_U_U'; // Example playlist
try {
    const data = await ytmusic.getPlaylist(playlistId);
    console.log('Playlist Name:', data.name);
    console.log('Playlist tracks count:', data.songs?.length || data.tracks?.length || 0);
    console.log('First track sample:', JSON.stringify((data.songs || data.tracks || [])[0], null, 2));
} catch (e) {
    console.error('Error fetching playlist:', e.message);
}
