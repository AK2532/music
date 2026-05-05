import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import { ListPlus, Loader2, Music, Play, Radio, Search as SearchIcon, User, X, Mic, Clock, MoreVertical, Download, ArrowUpToLine, ListMusic } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { gsap } from 'gsap';
import { musicService } from '../services/api';
import { usePlayerStore } from '../stores/playerStore';

// Removed markMatch to satisfy user request of not highlighting search terms

const emptyResults = { suggestions: [], top: [], songs: [], videos: [], albums: [], artists: [], playlists: [] };

// ── SimpMusic-style search categorization ─────────────────────────────────────
// Artists top 3 first, then Songs, Videos, Albums, Playlists
function buildOrderedResults(results) {
  const { artists = [], songs = [], videos = [], albums = [], playlists = [] } = results;
  const topArtists = artists.slice(0, 3);
  const rest = [...songs, ...videos, ...albums, ...playlists];
  return { topArtists, rest, songs, videos, albums, artists, playlists };
}

const CategoryChip = ({ label, active, onClick }) => (
  <button type="button" className={`search-cat-chip ${active ? 'search-cat-chip--active' : ''}`} onClick={onClick}>
    {label}
  </button>
);

const SEARCH_CATS = ['All', 'Songs', 'Videos', 'Albums', 'Artists', 'Playlists'];

const SearchView = ({ songs = [], onPlay, onPlayCollection, currentSong, isPlaying, metadata }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(emptyResults);
  const [searching, setSearching] = useState(false);
  const [category, setCategory] = useState('All');
  const [isExpanded, setIsExpanded] = useState(false);
  const loadQueueAndPlay = usePlayerStore(state => state.loadQueueAndPlay);
  const toggleRadioMode = usePlayerStore(state => state.toggleRadioMode);
  const openPlaylistPicker = usePlayerStore(state => state.openPlaylistPicker);

  const [isListening, setIsListening] = useState(false);
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('search_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  const saveToDevice = (song) => {
    const link = document.createElement('a');
    link.href = musicService.getDownloadUrl(song.id, `${song.title} - ${typeof song.artist === 'object' ? song.artist.name : song.artist}`);
    link.download = `${song.title}.m4a`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const addToHistory = (q) => {
    const term = q.trim();
    if (!term) return;
    const normalized = term.charAt(0).toUpperCase() + term.slice(1).toLowerCase();
    const next = [normalized, ...history.filter(h => h.toLowerCase() !== term.toLowerCase())].slice(0, 10);
    setHistory(next);
    localStorage.setItem('search_history', JSON.stringify(next));
  };

  const removeFromHistory = (e, term) => {
    e.stopPropagation();
    const next = history.filter(h => h !== term);
    setHistory(next);
    localStorage.setItem('search_history', JSON.stringify(next));
  };

  const performFullSearch = async (q) => {
    const term = q.trim();
    if (term.length < 2) return;
    setSearching(true);
    setShowDropdown(false);
    addToHistory(term);
    try {
      const data = await musicService.searchCatalog(term);
      setResults(data || emptyResults);
      setIsExpanded(true);
    } finally {
      setSearching(false);
    }
  };

  const startVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Your browser does not support voice search.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      performFullSearch(transcript);
    };

    recognition.start();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      performFullSearch(query);
    }
  };
  
  const startArtistRadio = async (artist) => {
    setSearching(true);
    try {
      const radioTracks = await musicService.getArtistRadio(artist.id);
      if (radioTracks?.length) {
        toggleRadioMode(true);
        loadQueueAndPlay(radioTracks, radioTracks[0]);
      }
    } finally {
      setSearching(false);
    }
  };
  const [menuOpenId, setMenuOpenId] = useState(null);
  const menuRef = useRef(null);

  const handleMenuAction = (action, song) => {
    setMenuOpenId(null);
    const pref = metadata?.downloadPref || 'ask';

    switch (action) {
      case 'download':
        if (pref === 'ask') {
          usePlayerStore.getState().openDownloadPicker(song);
        } else if (pref === 'storage' || pref === 'both') {
          saveToDevice(song);
          if (pref === 'both') usePlayerStore.getState().recordDownload({ ...song, localStatus: 'downloaded' });
        } else if (pref === 'app') {
          usePlayerStore.getState().recordDownload({ ...song, localStatus: 'downloaded' });
        }
        break;
      case 'playlist':
        openPlaylistPicker(song);
        break;
      case 'playNext':
        usePlayerStore.getState().addToQueueNext(song);
        break;
      case 'queue':
        usePlayerStore.getState().addToQueueEnd(song);
        break;
      default: break;
    }
  };

  useEffect(() => {
    const handleClickOutsideMenu = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpenId(null);
      }
    };
    if (menuOpenId) document.addEventListener('mousedown', handleClickOutsideMenu);
    return () => document.removeEventListener('mousedown', handleClickOutsideMenu);
  }, [menuOpenId]);

  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const ctx = gsap.context(() => {
      gsap.from('[data-search-reveal]', { y: 28, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' });
    }, containerRef);

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      ctx.revert();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { 
      setSuggestions([]); 
      return; 
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await musicService.getSearchSuggestions(q);
        setSuggestions((data || []).slice(0, 5));
      } catch (_) {
        setSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const noQuery = !query.trim();
  const ordered = buildOrderedResults(results);

  // Filter by category
  function getDisplaySongs() {
    if (category === 'Songs') return results.songs;
    if (category === 'Videos') return results.videos;
    if (category === 'All') return [...results.top.filter(i => i.type === 'song' || i.type === 'video'), ...results.songs, ...results.videos].slice(0, isExpanded ? 50 : 15);
    return [];
  }
  function getDisplayCollections() {
    if (category === 'Albums') return results.albums;
    if (category === 'Artists') return results.artists;
    if (category === 'Playlists') return results.playlists;
    if (category === 'All') return [...results.albums, ...results.artists, ...results.playlists].slice(0, isExpanded ? 40 : 10);
    return [];
  }

  const displaySongs = getDisplaySongs();
  const displayCollections = getDisplayCollections();
  const hasResults = !noQuery && (displaySongs.length > 0 || displayCollections.length > 0 || ordered.topArtists.length > 0);

  return (
    <div ref={containerRef} className={`premium-search ${noQuery ? 'premium-search--idle' : ''}`}>
      {/* Search box */}
      <section className="premium-search__hero" data-search-reveal>
        <div className="premium-kicker">
          <SearchIcon size={16} />
          Search the catalog
        </div>
        <label className="premium-searchbox" htmlFor="music-search">
          <SearchIcon size={24} />
          <input
            id="music-search"
            ref={inputRef}
            type="text"
            value={query}
            autoComplete="off"
            spellCheck="false"
            onFocus={() => setShowDropdown(true)}
            onChange={e => { 
              setQuery(e.target.value); 
              setShowDropdown(true);
              setIsExpanded(false); 
              if (e.target.value.trim().length < 2) setSearching(false); 
            }}
            onKeyDown={handleKeyDown}
            placeholder="Find songs, artists, albums..."
          />
          <span className="premium-searchbox__actions">
            {searching ? <Loader2 size={24} className="spin" /> : null}
            {query && !searching ? (
              <button type="button" onClick={() => { setQuery(''); setSearching(false); setResults(emptyResults); }} aria-label="Clear search">
                <X size={22} />
              </button>
            ) : null}
            <button 
              type="button" 
              onClick={startVoiceSearch} 
              aria-label="Voice Search"
              style={{ color: isListening ? 'var(--accent)' : 'inherit', marginLeft: '8px' }}
            >
              {isListening ? <Loader2 size={22} className="spin" /> : <Mic size={22} />}
            </button>
          </span>
        </label>

        {/* Search Suggestions & History Dropdown */}
        <AnimatePresence>
          {showDropdown && (history.length > 0 || suggestions.length > 0) && (
            <motion.div 
              className="search-dropdown" 
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {history.length > 0 && (
                <div className="search-dropdown-header">
                  <span className="mono-label">Recent Searches</span>
                  <button type="button" className="clear-history-all" onClick={(e) => { e.stopPropagation(); setHistory([]); localStorage.removeItem('search-history'); }}>
                    Clear all
                  </button>
                </div>
              )}
              {history.map(item => (
                <div key={item} className="search-dropdown-item search-dropdown-item--history" onClick={() => { setQuery(item); performFullSearch(item); }}>
                  <Clock size={16} />
                  <span>{item}</span>
                  <button type="button" className="remove-history" onClick={(e) => removeFromHistory(e, item)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              {suggestions.length > 0 && (
                <div className="search-dropdown-header">
                  <span className="mono-label">Suggestions</span>
                </div>
              )}
              {suggestions.map(item => (
                <div key={item} className="search-dropdown-item" onClick={() => { setQuery(item); performFullSearch(item); }}>
                  <SearchIcon size={16} />
                  <span>{item}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* SimpMusic-style category chips */}
        {!noQuery && hasResults && (
          <div className="search-cats">
            {SEARCH_CATS.map(cat => (
              <CategoryChip key={cat} label={cat} active={category === cat} onClick={() => setCategory(cat)} />
            ))}
          </div>
        )}
      </section>

      <AnimatePresence mode="popLayout">
        {/* Idle: quick picks */}
        {noQuery ? (
          <motion.section key="idle" className="premium-section" data-search-reveal initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '40vh', opacity: 0.5 }}>
              <Music size={48} style={{ marginBottom: '1rem' }} />
              <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>Ready to listen? Type something above.</p>
            </div>
          </motion.section>
        ) : null}

        {hasResults ? (
          <motion.section key="results" className="premium-search__results" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}>

            {/* SimpMusic: top artists row (if ≥1 artist + all/artists tab) */}
            {(category === 'All' || category === 'Artists') && ordered.topArtists.length > 0 ? (
              <div className="premium-section">
                <div className="premium-section__head">
                  <span className="mono-label">Artists</span>
                  <h2>Top matches.</h2>
                </div>
                <div className="search-artist-row">
                  {ordered.topArtists.map(artist => (
                    <div className="search-artist-wrapper" key={artist.id || artist.title}>
                      <button type="button" className="search-artist-card" onClick={() => onPlayCollection(artist)}>
                        <span className="search-artist-avatar">
                          {artist.thumbnail ? (
                            <img 
                              src={artist.thumbnail} 
                              alt={artist.title} 
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                if (e.target.src.includes('maxresdefault')) {
                                  e.target.src = e.target.src.replace('maxresdefault', 'hqdefault');
                                } else {
                                  e.target.onerror = null; 
                                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.title || 'Artist')}&background=random&size=512`;
                                }
                              }}
                            />
                          ) : <User size={28} />}
                        </span>
                        <strong>{artist.title}</strong>
                        <small>Artist</small>
                      </button>
                      <button 
                        type="button" 
                        className="artist-radio-btn" 
                        title="Start Artist Radio"
                        onClick={(e) => { e.stopPropagation(); startArtistRadio(artist); }}
                      >
                        <Radio size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Tracks */}
            {displaySongs.length > 0 && (category === 'All' || category === 'Songs' || category === 'Videos') ? (
              <div className="premium-section">
                <div className="premium-section__head">
                  <span className="mono-label">{category === 'Videos' ? 'Videos' : 'Tracks'}</span>
                  <h2>{category === 'All' ? 'Best matches.' : `${category}.`}</h2>
                </div>
                <div className="premium-list">
                  {displaySongs.slice(0, isExpanded ? 100 : 12).map((song, i) => {
                    const isActive = currentSong?.id === song.id;
                    const isMenuOpen = menuOpenId === song.id;
                    return (
                      <div
                        role="button"
                        tabIndex={0}
                        className={`premium-list-row ${isActive ? 'is-active' : ''} ${isMenuOpen ? 'has-open-menu' : ''}`}
                        key={`${song.id}-${i}`}
                        onClick={() => onPlay(song, displaySongs, true)}
                        onKeyDown={(e) => e.key === 'Enter' && onPlay(song, displaySongs, true)}
                      >
                        <span className="premium-list-row__index">{String(i + 1).padStart(2, '0')}</span>
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
                        <span className="premium-list-row__copy">
                          <strong>{song.title}</strong>
                          <small>{(typeof song.artist === 'object' ? song.artist?.name : song.artist)}</small>
                        </span>
                        <span className="premium-list-row__actions" ref={isMenuOpen ? menuRef : null}>
                          <button 
                            type="button" 
                            className={`row-action-btn ${isMenuOpen ? 'is-active' : ''}`} 
                            title="More options"
                            onClick={(e) => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : song.id); }}
                          >
                            <MoreVertical size={18} />
                          </button>
                          <AnimatePresence>
                            {isMenuOpen && (
                              <motion.div 
                                className="premium-tile-dropdown premium-tile-dropdown--row"
                                onClick={(e) => e.stopPropagation()}
                                initial={{ opacity: 0, scale: 0.95, x: 10 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95, x: 10 }}
                                transition={{ duration: 0.1 }}
                              >
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleMenuAction('download', song); }}>
                                  <Download size={14} /> Download
                                </button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleMenuAction('playlist', song); }}>
                                  <ListPlus size={14} /> Add to playlist
                                </button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleMenuAction('playNext', song); }}>
                                  <ArrowUpToLine size={14} /> Play next
                                </button>
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleMenuAction('queue', song); }}>
                                  <ListMusic size={14} /> Add to queue
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Collections */}
            {displayCollections.length > 0 && (category === 'All' || category === 'Albums' || category === 'Playlists') ? (
              <div className="premium-section">
                <div className="premium-section__head">
                  <span className="mono-label">Collections</span>
                  <h2>Albums, playlists.</h2>
                </div>
                <div className="premium-result-grid">
                  {displayCollections.slice(0, isExpanded ? 60 : 8).map(item => (
                    <button type="button" className="premium-result-card" key={item.id || item.title} onClick={() => onPlayCollection(item)}>
                      <img 
                        src={item.thumbnail} 
                        alt={item.title} 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (e.target.src.includes('maxresdefault')) {
                            e.target.src = e.target.src.replace('maxresdefault', 'hqdefault');
                          } else {
                            e.target.onerror = null; 
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.title || 'Collection')}&background=random&size=512`;
                          }
                        }}
                      />
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.subtitle || item.type || 'Open collection'}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

          </motion.section>
        ) : null}

        {!searching && !noQuery && !hasResults ? (
          <motion.div key="empty" className="premium-empty" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            <SearchIcon size={34} />
            <strong>No matches for "{query}"</strong>
            <span>Try a track, artist, album, or playlist name.</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default SearchView;
