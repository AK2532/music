import { ChevronDown, ChevronUp, Download, Heart, ListMusic, ListPlus, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import { musicService } from '../services/api';
import { SeekBar } from './SeekBar';
import { usePlayerStore } from '../stores/playerStore';

function fmt(seconds) {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function RepeatIcon({ mode }) {
  if (mode === 'one') return <Repeat1 size={20} />;
  return <Repeat size={20} />;
}

export function NowPlayingFull({ audioRef, onClose, metadata }) {
  const [lyrics, setLyrics] = useState({ lines: [], text: '' });
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [downloadState, setDownloadState] = useState({ songId: null, status: 'idle' });
  const [panelView, setPanelView] = useState('lyrics');
  const [downloadAskOpen, setDownloadAskOpen] = useState(false);
  const [removeAskOpen, setRemoveAskOpen] = useState(false);
  const containerRef = useRef(null);
  const vinylTweenRef = useRef(null);

  const song = usePlayerStore((state) => state.currentSong);
  const isShuffled = usePlayerStore((state) => state.isShuffled);
  const queue = usePlayerStore((state) => (state.isShuffled ? state.shuffledQueue : state.queue));
  const currentIndex = usePlayerStore((state) => state.currentIndex);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const likedIds = usePlayerStore((state) => state.likedIds);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const radioMode = usePlayerStore((state) => state.radioMode);
  const lyricsProvider = usePlayerStore((state) => state.lyricsProvider);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const playNext = usePlayerStore((state) => state.playNext);
  const playPrev = usePlayerStore((state) => state.playPrev);
  const toggleLike = usePlayerStore((state) => state.toggleLike);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat);
  const recordDownload = usePlayerStore((state) => state.recordDownload);
  const removeDownload = usePlayerStore((state) => state.removeDownload);
  const downloads = usePlayerStore((state) => state.downloads);
  const playSongAt = usePlayerStore((state) => state.playSongAt);
  const playlists = usePlayerStore((state) => state.playlists);
  const openPlaylistPicker = usePlayerStore((state) => state.openPlaylistPicker);
  const songId = song?.id;
  const songTitle = song?.title;
  const songArtist = song?.artist;

  useEffect(() => {
    if (!songId) return;
    let cancelled = false;

    const loadLyrics = async () => {
      setLyricsLoading(true);
      try {
        const payload = await musicService.getLyrics({ id: songId, title: songTitle, artist: songArtist }, lyricsProvider);
        if (!cancelled) setLyrics(payload || { lines: [], text: '' });
      } finally {
        if (!cancelled) setLyricsLoading(false);
      }
    };

    loadLyrics();
    return () => {
      cancelled = true;
    };
  }, [songId, songTitle, songArtist, lyricsProvider]);

  useEffect(() => {
    if (!songId) return;

    const ctx = gsap.context(() => {
      gsap.from('[data-player-reveal]', {
        y: 34,
        opacity: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'power3.out',
      });

    }, containerRef);

    return () => ctx.revert();
  }, [songId]);

  useEffect(() => {
    const vinyl = containerRef.current?.querySelector('.premium-player__vinyl');
    if (!vinyl) return;

    if (!vinylTweenRef.current) {
      vinylTweenRef.current = gsap.to(vinyl, {
        rotate: 360,
        duration: 14,
        repeat: -1,
        ease: 'none',
        paused: true,
      });
    }

    if (isPlaying) vinylTweenRef.current.play();
    else vinylTweenRef.current.pause();
  }, [isPlaying, song?.id]);

  if (!song) return null;

  const liked = likedIds.has(song.id);
  const savedInApp = downloads.some((item) => item.id === song.id);
  const downloadStatus = savedInApp ? 'saved in app' : downloadState.songId === song.id ? downloadState.status : 'idle';
  const upcoming = queue.slice(currentIndex + 1);
  const syncedLines = lyrics.lines?.filter((line) => line?.text) || [];
  const activeLyricIndex = syncedLines.findIndex((line, index) => {
    const nextLine = syncedLines[index + 1];
    const endTime = line.endTime ?? nextLine?.startTime ?? Number.POSITIVE_INFINITY;
    return currentTime >= line.startTime && currentTime < endTime;
  });
  const plainLyricLines = lyrics.text?.split('\n')
    .map(line => line.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '').trim())
    .filter(Boolean) || [];

  const activeLyricRef = useRef(null);
  useEffect(() => {
    if (activeLyricRef.current) {
      const isMobile = window.innerWidth < 1100;
      const container = containerRef.current;
      
      if (!isMobile) {
        activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (container && container.scrollTop > 300) {
        // On mobile, only auto-scroll if the user has already scrolled down to see the lyrics
        activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLyricIndex]);

  const saveToDevice = () => {
    const link = document.createElement('a');
    link.href = musicService.getDownloadUrl(song.id, `${song.title} - ${song.artist}`);
    link.download = `${song.title}.m4a`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const saveInApp = () => {
    recordDownload({ ...song, localStatus: 'downloaded' });
  };

  const performDownload = (destination) => {
    setDownloadAskOpen(false);
    setDownloadState({ songId: song.id, status: 'downloading' });

    if (destination === 'app' || destination === 'both') saveInApp();
    if (destination === 'storage' || destination === 'both') saveToDevice();

    const labelByDestination = {
      app: 'saved in app',
      storage: 'sent to device',
      both: 'downloaded',
    };
    window.setTimeout(() => setDownloadState({ songId: song.id, status: labelByDestination[destination] || 'downloaded' }), 700);
  };

  const openDownloadPicker = usePlayerStore(state => state.openDownloadPicker);

  const handleDownload = () => {
    if (savedInApp) {
      setRemoveAskOpen(true);
      return;
    }

    const preference = metadata?.downloadPref || 'ask';
    if (preference === 'ask') {
      openDownloadPicker(song);
      return;
    }
    performDownload(preference);
  };

  const seekToLyric = (line) => {
    if (!Number.isFinite(line?.startTime)) return;
    if (audioRef.current) audioRef.current.currentTime = line.startTime;
    usePlayerStore.getState().setCurrentTime(line.startTime);
  };

  const [lyricsMode, setLyricsMode] = useState('synced'); // 'synced' or 'plain'

  return (
    <motion.div
      ref={containerRef}
      className="premium-player"
      data-lenis-prevent
      onWheel={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 250 }}
    >
      <div className="premium-player__ambient" style={{ backgroundImage: `url(${song.thumbnail})` }} />

      <header className="premium-player__top" data-player-reveal>
        <button type="button" className="player-icon-btn" onClick={onClose} aria-label="Close player">
          <ChevronDown size={24} />
        </button>
        <div className="premium-player__top-center">
          <button
            type="button"
            className={`premium-top-upnext ${panelView === 'queue' ? 'is-active' : ''}`}
            onClick={() => setPanelView((view) => view === 'queue' ? 'lyrics' : 'queue')}
          >
            {panelView === 'queue' ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
            {panelView === 'queue' ? 'Back' : 'Up next'}
          </button>
          <span>
            <span className="mono-label">Now spinning</span>
            <strong>{metadata?.username || 'A.K Music'}</strong>
          </span>
        </div>
        <button
          type="button"
          className={`player-icon-btn ${panelView === 'queue' ? 'is-active' : ''}`}
          onClick={() => setPanelView((view) => view === 'queue' ? 'lyrics' : 'queue')}
          aria-label={panelView === 'queue' ? 'Back to lyrics' : 'Open up next'}
        >
          {panelView === 'queue' ? <ChevronDown size={23} /> : <ChevronUp size={23} />}
        </button>
      </header>

      {panelView === 'queue' ? (
        <main className="premium-player-queue-page" data-player-reveal>
          <div className="premium-player-queue-page__head">
            <div>
              <span className="mono-label">Up next</span>
              <h1>Queue</h1>
              <p>{upcoming.length ? `${upcoming.length} tracks waiting after this song.` : 'No more tracks queued.'}</p>
            </div>
            <button type="button" className="button-secondary" onClick={() => setPanelView('lyrics')}>
              <ChevronDown size={18} />
              Back to player
            </button>
          </div>

          <div className="premium-player-queue-page__current">
            <img 
              src={song.thumbnail} 
              alt={song.title} 
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
            <span>
              <small>Currently playing</small>
              <strong>{song.title}</strong>
              <em>{(typeof song.artist === 'object' ? song.artist?.name : song.artist)}</em>
            </span>
          </div>

          <div className="premium-player-queue-page__list" data-lenis-prevent>
            {upcoming.length ? upcoming.map((item, index) => (
              <button type="button" key={item.id} className="premium-player__queue-row" onClick={() => { playSongAt(item); setPanelView('lyrics'); }}>
                <span className="premium-player__queue-index">{String(index + 1).padStart(2, '0')}</span>
                <img 
                  src={item.thumbnail} 
                  alt="" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    if (e.target.src.includes('maxresdefault')) {
                      e.target.src = e.target.src.replace('maxresdefault', 'hqdefault');
                    } else {
                      e.target.onerror = null; 
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title || 'Music')}&background=random&size=512`;
                    }
                  }}
                />
                <span>
                  <strong>{item.title}</strong>
                  <small>{(typeof item.artist === 'object' ? item.artist?.name : item.artist)}</small>
                </span>
                <ListMusic size={17} />
              </button>
            )) : <p>No more tracks queued.</p>}
          </div>
        </main>
      ) : (
        <main className="premium-player__grid">
          <section className="premium-player__stage" data-player-reveal>
            <div className="premium-player__vinyl" aria-hidden="true">
              <img 
                src={song.thumbnail} 
                alt="" 
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
            <div className="premium-player__art">
              <img 
                src={song.thumbnail} 
                alt={song.title} 
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
          </section>

          <section className="premium-player__console" data-player-reveal>
            <div className="premium-player__title">
              <span className="mono-label">Track</span>
              <h1>{song.title}</h1>
              <p style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(typeof song.artist === 'object' ? song.artist?.name : song.artist)}</p>
            </div>

            <div className="premium-player__seek">
              <SeekBar onSeek={(time) => { if (audioRef.current) audioRef.current.currentTime = time; }} />
              <div>
                <span>{fmt(currentTime)}</span>
                <span>{fmt(duration)}</span>
              </div>
            </div>

            <div className="premium-player__controls">
              <button type="button" className={`player-icon-btn ${isShuffled ? 'is-active' : ''}`} onClick={toggleShuffle} aria-label="Shuffle">
                <Shuffle size={20} />
              </button>
              <button type="button" className="player-icon-btn player-icon-btn--transport" onClick={playPrev} aria-label="Previous">
                <SkipBack size={24} />
              </button>
              <button type="button" className="player-play-btn" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause size={34} fill="currentColor" /> : <Play size={34} fill="currentColor" />}
              </button>
              <button 
                type="button" 
                className="player-icon-btn player-icon-btn--transport" 
                onClick={playNext} 
                aria-label="Next"
                disabled={!radioMode && repeatMode === 'none' && currentIndex >= queue.length - 1}
              >
                <SkipForward size={24} />
              </button>
              <button type="button" className={`player-icon-btn ${repeatMode !== 'none' ? 'is-active' : ''}`} onClick={cycleRepeat} aria-label="Repeat">
                <RepeatIcon mode={repeatMode} />
              </button>
            </div>

            <div className="premium-player__actions">
              <button type="button" className={liked ? 'is-active' : ''} onClick={() => toggleLike(song.id)}>
                <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
                {liked ? 'Liked' : 'Like'}
              </button>
              <button type="button" onClick={() => openPlaylistPicker(song)} style={{ width: '100%' }}>
                <ListPlus size={18} />
                Add to playlist
              </button>
              <button type="button" onClick={handleDownload} className={savedInApp || downloadStatus === 'downloaded' ? 'is-active' : ''}>
                <Download size={18} />
                {downloadStatus === 'downloading' ? 'Starting...' : downloadStatus === 'idle' ? 'Save offline' : downloadStatus}
              </button>
            </div>
          </section>

          <aside className="premium-player__side" data-player-reveal>
            <div className="premium-player-panel premium-player-panel--single">
              <div className="premium-player-panel__head">
                <span className="mono-label">Lyrics</span>
                <div className="lyrics-mode-toggle">
                  {syncedLines.length > 0 && (
                    <button 
                      type="button" 
                      className={lyricsMode === 'synced' ? 'is-active' : ''} 
                      onClick={() => setLyricsMode('synced')}
                    >
                      Sync
                    </button>
                  )}
                  {plainLyricLines.length > 0 && (
                    <button 
                      type="button" 
                      className={lyricsMode === 'plain' ? 'is-active' : ''} 
                      onClick={() => setLyricsMode('plain')}
                    >
                      Plain
                    </button>
                  )}
                </div>
              </div>
              <div className="premium-player__lyrics" data-lenis-prevent>
                {lyricsLoading ? (
                  <p>Finding words...</p>
                ) : lyricsMode === 'synced' && syncedLines.length ? (
                  syncedLines.map((line, idx) => (
                    <button
                      type="button"
                      key={`${line.startTime}-${idx}`}
                      ref={activeLyricIndex === idx ? activeLyricRef : null}
                      className={activeLyricIndex === idx ? 'is-active' : ''}
                      onClick={() => seekToLyric(line)}
                    >
                      {line.text}
                    </button>
                  ))
                ) : plainLyricLines.length ? (
                  plainLyricLines.map((line, idx) => <p key={idx}>{line}</p>)
                ) : (
                  <p>Lyrics are not available for this track yet.</p>
                )}
              </div>
            </div>
          </aside>
        </main>
      )}

      {removeAskOpen ? (
        <div className="premium-download-choice" role="dialog" aria-modal="true" aria-label="Remove saved track">
          <div className="premium-download-choice__card">
            <div>
              <span className="mono-label">Saved in app</span>
              <h3>Remove this track from Offline?</h3>
            </div>
            <div className="premium-download-choice__actions">
              <button
                type="button"
                onClick={() => {
                  removeDownload(song.id);
                  setRemoveAskOpen(false);
                  setDownloadState({ songId: song.id, status: 'idle' });
                }}
              >
                Remove from app
              </button>
            </div>
            <button type="button" className="premium-download-choice__cancel" onClick={() => setRemoveAskOpen(false)}>Keep saved</button>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
