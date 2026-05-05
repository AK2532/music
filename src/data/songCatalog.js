export function enrichSong(song) {
  if (!song) return song;
  return {
    ...song,
    streamUrl: song.streamUrl || null,
  };
}

export function normalizeSongs(songs = []) {
  return songs.map(enrichSong);
}
