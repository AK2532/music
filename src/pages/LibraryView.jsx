import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Clock3, ListMusic, Play, Plus, Save, Trash2, X } from 'lucide-react';
import { usePlayerStore } from '../stores/playerStore';
import { Modal } from '../components/Modal';

function uniqSongs(items) {
  return Array.from(new Map(items.filter(Boolean).map((song) => [song.id, song])).values());
}

export default function LibraryView({ songs = [], onPlay, currentSong, isPlaying }) {
  const [tab, setTab] = useState('likes');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, type: '', title: '', value: '', onConfirm: null });

  const likedIds = usePlayerStore((state) => state.likedIds);
  const playHistory = usePlayerStore((state) => state.playHistory);
  const playlists = usePlayerStore((state) => state.playlists);
  const playCounts = usePlayerStore((state) => state.playCounts);
  const queue = usePlayerStore((state) => (state.isShuffled ? state.shuffledQueue : state.queue));
  const downloads = usePlayerStore((state) => state.downloads);

  const createPlaylist = usePlayerStore((state) => state.createPlaylist);
  const deletePlaylist = usePlayerStore((state) => state.deletePlaylist);
  const playPlaylist = usePlayerStore((state) => state.playPlaylist);
  const removeFromQueue = usePlayerStore((state) => state.removeFromQueue);
  const clearQueue = usePlayerStore((state) => state.clearQueue);
  const reorderQueue = usePlayerStore((state) => state.reorderQueue);
  const addToPlaylist = usePlayerStore((state) => state.addToPlaylist);
  const playSongAt = usePlayerStore((state) => state.playSongAt);

  const allKnownSongs = useMemo(() => uniqSongs([
    ...songs,
    ...queue,
    ...playHistory,
    ...playlists.flatMap((playlist) => playlist.songs),
  ]), [songs, queue, playHistory, playlists]);

  const likedSongs = useMemo(() => allKnownSongs.filter((song) => likedIds.has(song.id)), [allKnownSongs, likedIds]);
  const topTracks = useMemo(
    () => [...allKnownSongs].sort((left, right) => (playCounts[right.id] || 0) - (playCounts[left.id] || 0)).slice(0, 8),
    [allKnownSongs, playCounts],
  );
  const effectiveSelectedPlaylistId = playlists.some((playlist) => playlist.id === selectedPlaylistId)
    ? selectedPlaylistId
    : (playlists[0]?.id || null);
  const selectedPlaylist = playlists.find((playlist) => playlist.id === effectiveSelectedPlaylistId) || null;
  const historyDescending = [...playHistory].reverse();

  const tabs = [
    { id: 'likes', label: 'Liked songs' },
    { id: 'playlists', label: 'Playlists' },
    { id: 'queue', label: 'Queue' },
    { id: 'history', label: 'History' },
    { id: 'stats', label: 'Stats' },
  ];

  return (
    <div className="view-padding library-view-main">

      <header className="editorial-section" style={{ borderBottom: '1px solid var(--text-faint)', paddingBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p className="mono-label">Personal Collection</p>
        <h1 className="library-header-title">
          Your library,<br />
          <span style={{ color: 'var(--text-muted)' }}>properly organized.</span>
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '2rem' }}>
          {tabs.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setTab(entry.id)}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '999px',
                border: '1px solid var(--text-faint)',
                background: tab === entry.id ? 'var(--text-main)' : 'transparent',
                color: tab === entry.id ? 'var(--bg-main)' : 'var(--text-main)',
                fontWeight: 600,
                fontSize: '1rem',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">

        {/* LIKED SONGS */}
        {tab === 'likes' && (
          <motion.section key="likes" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="editorial-section">
            <div className="editorial-section-head">
              <div>
                <p className="mono-label">{likedSongs.length} tracks</p>
                <h3 className="editorial-title">Saved Tracks</h3>
              </div>
              {likedSongs.length > 0 && (
                <div className="editorial-actions">
                  <button className="btn-primary" onClick={() => onPlay(likedSongs[0], likedSongs)}>
                    <Play size={16} fill="currentColor" /> Play All
                  </button>
                </div>
              )}
            </div>

            {likedSongs.length ? (
              <div className="song-card-grid">
                {likedSongs.map((song) => (
                  <div key={song.id} className="glass-panel" onClick={() => onPlay(song, likedSongs)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer', padding: '1rem' }}>
                    <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '12px', overflow: 'hidden' }}>
                      <img
                        src={song.thumbnail}
                        alt={song.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (e.target.src.includes('maxresdefault')) {
                            e.target.src = e.target.src.replace('maxresdefault', 'hqdefault');
                          } else {
                            e.target.onerror = null;
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(song.title || 'Music')}&background=random&size=512`;
                          }
                        }}
                      />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: currentSong?.id === song.id ? 'var(--text-main)' : 'inherit' }}>
                        {song.title}
                      </h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(typeof song.artist === 'object' ? song.artist?.name : song.artist)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                No liked songs yet.
              </div>
            )}
          </motion.section>
        )}

        {/* PLAYLISTS */}
        {tab === 'playlists' && (
          <motion.section key="playlists" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="editorial-section">
            <div className="editorial-section-head">
              <div>
                <p className="mono-label">{playlists.length} playlists</p>
                <h3 className="editorial-title">Playlists</h3>
              </div>
              <div className="editorial-actions">
                <button
                  className="btn-primary"
                  onClick={() => setModal({
                    isOpen: true, type: 'prompt', title: 'New Playlist', value: '',
                    onConfirm: (val) => { const name = val.trim().slice(0, 20); if (name) setSelectedPlaylistId(createPlaylist(name)); }
                  })}
                >
                  <Plus size={16} /> New Playlist
                </button>
              </div>
            </div>

            {!playlists.length ? (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                <ListMusic size={40} style={{ opacity: 0.3, margin: '0 auto 1rem' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '0.5rem' }}>No playlists yet.</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '340px', margin: '0 auto' }}>Create a playlist to organise your favourite tracks. Click "New Playlist" above to get started.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {playlists.map((playlist) => {
                  const isExpanded = effectiveSelectedPlaylistId === playlist.id;
                  return (
                    <div key={playlist.id} className="glass-panel" style={{ overflow: 'hidden' }}>
                      {/* Playlist header row */}
                      <div
                        className="library-playlist-item"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', cursor: 'pointer' }}
                        onClick={() => setSelectedPlaylistId(isExpanded ? null : playlist.id)}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playlist.name}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px' }}>{playlist.songs.length} {playlist.songs.length === 1 ? 'track' : 'tracks'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                          <button className="icon-btn" style={{ width: '34px', height: '34px' }} onClick={(e) => { e.stopPropagation(); playPlaylist(playlist.id); }}>
                            <Play size={15} fill="currentColor" />
                          </button>
                          <button className="icon-btn" style={{ width: '34px', height: '34px' }} onClick={(e) => {
                            e.stopPropagation();
                            setModal({ isOpen: true, type: 'confirm', title: 'Delete Playlist', message: `Delete "${playlist.name}"?`, onConfirm: () => deletePlaylist(playlist.id) });
                          }}>
                            <Trash2 size={15} color="var(--text-muted)" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded track list */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--text-faint)', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {playlist.songs.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>This playlist is empty.</p>
                          ) : playlist.songs.map((song) => (
                            <div
                              key={song.id}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.15s' }}
                              onClick={() => playPlaylist(playlist.id, song)}
                              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <img
                                src={song.thumbnail}
                                alt={song.title}
                                style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                                onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(song.title)}&background=random&size=128`; }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.95rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.section>
        )}

        {/* QUEUE */}
        {tab === 'queue' && (
          <motion.section key="queue" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="editorial-section">
            <div className="editorial-section-head">
              <div>
                <p className="mono-label">{queue.length} songs</p>
                <h3 className="editorial-title">Up Next</h3>
              </div>
              <div className="editorial-actions">
                {queue.length > 0 && (
                  <button
                    className="btn-ghost"
                    onClick={() => setModal({
                      isOpen: true, type: 'prompt', title: 'Save Queue', value: '',
                      onConfirm: (val) => {
                        const name = val.trim().slice(0, 20);
                        if (!name) return;
                        const playlistId = createPlaylist(name);
                        queue.forEach((song) => addToPlaylist(playlistId, song));
                        setSelectedPlaylistId(playlistId);
                        setTab('playlists');
                      }
                    })}
                  >
                    <Save size={15} /> Save
                  </button>
                )}
                <button
                  className="btn-ghost"
                  onClick={clearQueue}
                >
                  Clear
                </button>
              </div>
            </div>

            {queue.length ? (
              <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {queue.map((song, index) => (
                  <div key={`${song.id}-${index}`} className="queue-item" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', background: currentSong?.id === song.id ? 'rgba(var(--accent-rgb), 0.08)' : 'transparent', borderRadius: '16px', border: currentSong?.id === song.id ? '1px solid var(--glass-border)' : '1px solid transparent', transition: 'all 0.2s' }}>
                    <div className="mono-label" style={{ width: '24px', textAlign: 'right', opacity: 0.5 }}>{index + 1}</div>
                    <img
                      src={song.thumbnail}
                      alt=""
                      style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        if (e.target.src.includes('maxresdefault')) {
                          e.target.src = e.target.src.replace('maxresdefault', 'hqdefault');
                        } else {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(song.title || 'Music')}&background=random&size=512`;
                        }
                      }}
                    />
                    <button style={{ flex: 1, textAlign: 'left', minWidth: 0 }} onClick={() => playSongAt(song)}>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: currentSong?.id === song.id ? 'var(--text-main)' : 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(typeof song.artist === 'object' ? song.artist?.name : song.artist)}</div>
                    </button>
                    <div className="queue-item-actions" style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="icon-btn" style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.03)' }} onClick={() => reorderQueue(index, index - 1)} disabled={index === 0}>
                        <ChevronUp size={14} />
                      </button>
                      <button className="icon-btn" style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.03)' }} onClick={() => reorderQueue(index, index + 1)} disabled={index === queue.length - 1}>
                        <ChevronDown size={14} />
                      </button>
                      <button className="icon-btn" style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.03)' }} onClick={() => removeFromQueue(song.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                Queue is empty.
              </div>
            )}
          </motion.section>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <motion.section key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="editorial-section">
            <div className="editorial-section-head">
              <div>
                <p className="mono-label">{historyDescending.length} tracks</p>
                <h3 className="editorial-title">Listening History</h3>
              </div>
            </div>
            {historyDescending.length ? (
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem' }}>
                {historyDescending.map((song) => (
                  <div
                    key={`${song.playedAt}-${song.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: '12px', cursor: 'pointer', transition: 'background 0.15s' }}
                    onClick={() => onPlay(song, historyDescending)}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <img
                      src={song.thumbnail}
                      alt={song.title}
                      style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        if (e.target.src.includes('maxresdefault')) {
                          e.target.src = e.target.src.replace('maxresdefault', 'hqdefault');
                        } else {
                          e.target.onerror = null;
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(song.title || 'Music')}&background=random&size=128`;
                        }
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(typeof song.artist === 'object' ? song.artist?.name : song.artist)}</div>
                    </div>
                    <Clock3 size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0.5 }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                No listening history available.
              </div>
            )}
          </motion.section>
        )}

        {/* STATS */}
        {tab === 'stats' && (
          <motion.section key="stats" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="editorial-section">
            <div className="editorial-section-head">
              <div>
                <p className="mono-label">All time</p>
                <h3 className="editorial-title">Top Played</h3>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {topTracks.length ? topTracks.map((song, index) => (
                <div key={song.id} className="library-stats-row" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                  <div className="mono-label stats-rank" style={{ width: '24px', textAlign: 'right', fontSize: '1.2rem' }}>{index + 1}</div>
                  <img
                    src={song.thumbnail}
                    alt=""
                    style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      if (e.target.src.includes('maxresdefault')) {
                        e.target.src = e.target.src.replace('maxresdefault', 'hqdefault');
                      } else {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(song.title || 'Music')}&background=random&size=512`;
                      }
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="library-stats-title" style={{ fontSize: '1rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
                    <div className="library-stats-artist" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist}</div>
                  </div>
                  <div className="library-stats-count" style={{ fontSize: '1rem', fontWeight: 800, flexShrink: 0 }}>{playCounts[song.id] || 0} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>plays</span></div>
                </div>
              )) : (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                  No playback stats available yet.
                </div>
              )}
            </div>
          </motion.section>
        )}

      </AnimatePresence>

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        footer={
          <>
            <button className="icon-btn" style={{ width: 'auto', padding: '0.75rem 1.5rem', borderRadius: '12px' }} onClick={() => setModal({ ...modal, isOpen: false })}>Cancel</button>
            <button className="btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px' }} onClick={() => { modal.onConfirm(modal.value); setModal({ ...modal, isOpen: false }); }}>Confirm</button>
          </>
        }
      >
        {modal.type === 'prompt' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p style={{ margin: 0 }}>Enter name (max 20 characters):</p>
            <input
              autoFocus
              type="text"
              value={modal.value}
              onChange={(e) => setModal({ ...modal, value: e.target.value.slice(0, 20) })}
              onKeyDown={(e) => { if (e.key === 'Enter') { modal.onConfirm(modal.value); setModal({ ...modal, isOpen: false }); } }}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--text-faint)',
                color: 'var(--text-main)',
                fontSize: '1.1rem',
                outline: 'none'
              }}
            />
          </div>
        ) : (
          <p style={{ margin: 0 }}>{modal.message}</p>
        )}
      </Modal>
    </div>
  );
}