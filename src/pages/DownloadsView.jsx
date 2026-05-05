import { Download } from 'lucide-react';
import { usePlayerStore } from '../stores/playerStore';

export default function DownloadsView({ onPlay, currentSong, isPlaying }) {
  const downloads = usePlayerStore((state) => state.downloads);
  const removeDownload = usePlayerStore((state) => state.removeDownload);

  return (
    <div style={{ display: 'grid', gap: '5rem', paddingBottom: '4rem' }}>
      <header className="editorial-section" style={{ borderBottom: '1px solid var(--text-faint)', paddingBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p className="mono-label">Offline Archive</p>
        <h1 style={{ maxWidth: '1000px', fontSize: 'clamp(3rem, 6vw, 6rem)', lineHeight: 1 }}>
          Your downloads,<br />
          <span style={{ color: 'var(--text-muted)' }}>ready to play.</span>
        </h1>
      </header>

      <section className="editorial-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--text-faint)', paddingBottom: '1rem', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '2rem' }}>Local Storage</h3>
          <span className="mono-label">{downloads.length} Tracks</span>
        </div>

        {downloads.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '2rem' }}>
            {downloads.map((song) => (
              <div 
                key={`${song.id}-${song.downloadedAt}`} 
                className="glass-panel" 
                style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => onPlay(song, downloads)}>
                  <img src={song.thumbnail} alt={song.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <button className="btn-primary" onClick={() => onPlay(song, downloads)} style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem', justifyContent: 'center' }}>
                    Play
                  </button>
                  <button className="icon-btn" onClick={() => removeDownload(song.id)} style={{ width: 'auto', padding: '0 1rem', borderRadius: '999px' }}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
            No downloads yet. Save tracks from the player.
          </div>
        )}
      </section>
    </div>
  );
}
