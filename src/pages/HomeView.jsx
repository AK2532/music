import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpToLine, Download, ListMusic, ListPlus, MoreVertical, Pause, Play, Radio, Sparkles, TrendingUp } from 'lucide-react';
import { gsap } from 'gsap';
import { MOOD_PARAMS, usePlayerStore } from '../stores/playerStore';
import { BrandLogo } from '../components/BrandLogo';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
};

const getItemSubtitle = (item) => {
  const artistName = typeof item.artist === 'object' ? item.artist?.name : item.artist;
  return artistName || item.subtitle || item.description || item.type || 'Collection';
};

const TrackTile = ({ item, onActivate, featured = false, metadata }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleMenuAction = (action, e) => {
    e.stopPropagation();
    setMenuOpen(false);
    const store = usePlayerStore.getState();
    const pref = metadata?.downloadPref || 'ask';
    
    switch (action) {
      case 'download':
        if (pref === 'ask') {
          store.openDownloadPicker(item);
        } else if (pref === 'storage' || pref === 'both') {
          const link = document.createElement('a');
          link.href = musicService.getDownloadUrl(item.id, `${item.title} - ${item.artist}`);
          link.download = `${item.title}.m4a`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          if (pref === 'both') store.recordDownload({ ...item, localStatus: 'downloaded' });
        } else if (pref === 'app') {
          store.recordDownload({ ...item, localStatus: 'downloaded' });
        }
        break;
      case 'playlist':
        store.openPlaylistPicker(item);
        break;
      case 'playNext':
        store.addToQueueNext(item);
        break;
      case 'addToQueue':
        store.addToQueueEnd(item);
        break;
      default: break;
    }
  };

  return (
    <div className={`premium-tile ${featured ? 'premium-tile--featured' : ''}`} style={{ position: 'relative' }}>
      <span className="premium-tile__media" onClick={onActivate} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
        <img 
          src={item.thumbnail} 
          alt={item.title} 
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
        <span className="premium-tile__play"><Play size={18} fill="currentColor" /></span>
      </span>

      <div className="premium-tile__more-container" ref={menuRef}>
        <button 
          type="button" 
          className="premium-tile__more-trigger"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          title="More options"
        >
          <MoreVertical size={18} />
        </button>
        
        <AnimatePresence>
          {menuOpen && (
            <motion.div 
              className="premium-tile-dropdown"
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              <button type="button" onClick={(e) => handleMenuAction('download', e)}>
                <Download size={14} /> Download
              </button>
              <button type="button" onClick={(e) => handleMenuAction('playlist', e)}>
                <ListPlus size={14} /> Add to playlist
              </button>
              <button type="button" onClick={(e) => handleMenuAction('playNext', e)}>
                <ArrowUpToLine size={14} /> Play next
              </button>
              <button type="button" onClick={(e) => handleMenuAction('addToQueue', e)}>
                <ListMusic size={14} /> Add to queue
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <span className="premium-tile__copy" onClick={onActivate} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
        <strong>{item.title}</strong>
        <small>{getItemSubtitle(item)}</small>
      </span>
    </div>
  );
};

const CompactTrackRow = ({ item, onActivate, metadata }) => (
  <div className="premium-compact-row">
    <div className="premium-compact-row__main" onClick={onActivate} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
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
      <span className="premium-compact-row__copy">
        <strong>{item.title}</strong>
        <small>{(typeof item.artist === 'object' ? item.artist?.name : item.artist) || item.subtitle || 'Artist'}</small>
      </span>
    </div>
    <div className="premium-compact-row__actions">
      <button
        type="button"
        className="row-action-btn"
        title="Add to Playlist"
        onClick={(e) => { e.stopPropagation(); usePlayerStore.getState().openPlaylistPicker(item); }}
      >
        <ListPlus size={18} />
      </button>
      <span className="premium-compact-row__action" onClick={onActivate} role="button" tabIndex={0} style={{ cursor: 'pointer' }}>
        <Play size={16} fill="currentColor" />
      </span>
    </div>
  </div>
);

const HomeView = ({ songs = [], sections = [], moods = [], onPlay, onPlayCollection, metadata, activeMood = 'default', onMoodChange, currentSong, isPlaying, isLoading }) => {
  const containerRef = useRef(null);

  // Randomize hero per session using a stable seed from session start
  const heroIndex = useMemo(() => Math.floor(Math.random() * Math.min(songs.length, 8)), [songs.length > 0]);
  const heroSong = currentSong || songs[heroIndex] || songs[0];
  const isHeroPlaying = !!(currentSong && currentSong.id === heroSong?.id);

  const topTracks = songs.slice(1, 9);
  const greeting = getGreeting();
  const listenerName = metadata?.username || 'you';
  const activeMoodInfo = MOOD_PARAMS.find(m => m.key === activeMood) || MOOD_PARAMS[0];

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-home-reveal]', { y: 34, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' });
      gsap.to('.premium-hero__art img', { scale: 1.08, duration: 9, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to('.premium-meter i', { scaleY: () => gsap.utils.random(0.35, 1.1), duration: () => gsap.utils.random(0.6, 1.2), repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.08 });
    }, containerRef);
    return () => ctx.revert();
  }, []); // Run entrance animations ONLY once on mount

  return (
    <div ref={containerRef} className="premium-home">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="premium-hero" data-home-reveal>
        <div className="premium-hero__copy">
          <div className="premium-kicker">
            <Sparkles size={16} />
            {isHeroPlaying ? 'Active session' : `${greeting} session for ${listenerName}`}
          </div>
          <h1>{isHeroPlaying ? 'Continuing your sound journey.' : 'Glass-clear sound for what you want next.'}</h1>
          <p>{isHeroPlaying ? `You're currently listening to ${heroSong.title} by ${heroSong.artist}. Explore more from your catalog or curated moods below.` : 'A.K Music blends your live catalog, recommendations, offline tracks, and playback controls into one polished listening surface.'}</p>
          <div className="premium-actions">
            {heroSong ? (
              <button type="button" className="button-primary" onClick={() => onPlay(heroSong, songs, true)}>
                {isHeroPlaying && isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                {isHeroPlaying ? 'Open player' : 'Play featured'}
              </button>
            ) : null}
            {moods?.[0] ? (
              <button type="button" className="button-secondary" onClick={() => onPlayCollection(moods[0])}>
                <Radio size={18} />
                Start radio
              </button>
            ) : null}
          </div>
        </div>

        {heroSong ? (
          <button type="button" className="premium-hero__art" onClick={() => onPlay(heroSong, songs, true)}>
            <img
              src={heroSong.thumbnail}
              alt={heroSong.title}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(heroSong.title || 'Music')}&background=random&size=512`;
              }}
            />
            <span className={`premium-hero__glass ${isHeroPlaying ? 'is-active' : ''}`}>
              <span>
                <small>{isHeroPlaying ? 'Now spinning' : 'Featured track'}</small>
                <strong>{heroSong.title}</strong>
                <em>{heroSong.artist}</em>
              </span>
              {(isHeroPlaying && isPlaying) ? (
                <span className="premium-meter" aria-hidden="true">
                  <i /><i /><i /><i /><i />
                </span>
              ) : (
                <span className="premium-tile__play"><Play size={24} fill="currentColor" /></span>
              )}
            </span>
          </button>
        ) : null}
      </section>

      {/* Mood selector */}
      <section className="premium-section" data-home-reveal>
        <div className="premium-section__head">
          <span className="mono-label">Filter by mood</span>
          <h2>What's the vibe?</h2>
        </div>
        <div className="mood-chips">
          {MOOD_PARAMS.map(m => (
            <button
              type="button"
              key={m.key}
              className={`mood-chip ${activeMood === m.key ? 'mood-chip--active' : ''}`}
              onClick={() => onMoodChange?.(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Dynamic Content Area ──────────────────────────────────────────── */}
      <div style={{ position: 'relative', transition: 'opacity 0.3s ease', opacity: isLoading ? 0.4 : 1, pointerEvents: isLoading ? 'none' : 'auto', minHeight: '300px' }}>
        {isLoading && (
          <div style={{ position: 'absolute', top: '4rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <motion.div
              animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <BrandLogo size={56} color="var(--text-main)" />
            </motion.div>
          </div>
        )}

        {/* ── Mood-filtered tracks ──────────────────────────────────────────── */}
      {topTracks.length > 0 ? (
        <section className="premium-section" data-home-reveal>
          <div className="premium-section__head premium-section__head--row">
            <div>
              <span className="mono-label">{activeMoodInfo.label} picks</span>
              <h2>Fresh rotation.</h2>
            </div>
            <TrendingUp size={28} />
          </div>
          <div className="premium-rail hide-scrollbar">
            {topTracks.map((song) => (
              <TrackTile key={song.id} item={song} onActivate={() => onPlay(song, songs, true)} metadata={metadata} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Mood channels (legacy) ─────────────────────────────────────────── */}
      {moods?.length > 0 ? (
        <section className="premium-section" data-home-reveal>
          <div className="premium-section__head">
            <span className="mono-label">Mood channels</span>
            <h2>Pick the room.</h2>
          </div>
          <div className="premium-mood-grid">
            {moods.slice(0, 8).map((mood, index) => (
              <button type="button" className="premium-mood" key={mood.id || mood.title} onClick={() => onPlayCollection(mood)}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{mood.title}</strong>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Curated sections from YouTube Music ──────────────────────────── */}
      {sections?.filter(s => !s.title?.toLowerCase().includes('community playlists')).map((section, index) => {
        const isSongHeavy = section.items.filter(i => i.type === 'song' || i.type === 'video').length > 4;

        // Chunk items into columns of 4 if it's song heavy
        const columns = [];
        if (isSongHeavy) {
          for (let i = 0; i < section.items.length; i += 4) {
            columns.push(section.items.slice(i, i + 4));
          }
        }

        return (
          <section className="premium-section" key={`${section.title}-${index}`} data-home-reveal>
            <div className="premium-section__head">
              <span className="mono-label">Curated shelf</span>
              <h2>{section.title}</h2>
            </div>

            {isSongHeavy ? (
              <div className="premium-column-rail hide-scrollbar">
                {columns.map((col, colIdx) => (
                  <div className="premium-column" key={colIdx}>
                    {col.map((item) => (
                      <CompactTrackRow
                        key={item.id || item.title}
                        item={item}
                        onActivate={() => onPlay(item, section.items, true)}
                        metadata={metadata}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="premium-rail hide-scrollbar">
                {section.items.map((item) => (
                  <TrackTile
                    key={item.id || `${section.title}-${item.title}`}
                    item={item}
                    featured
                    onActivate={() => item.type === 'song' || item.type === 'video' ? onPlay(item, section.items, true) : onPlayCollection(item)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
      </div>
    </div>
  );
};

export default HomeView;
