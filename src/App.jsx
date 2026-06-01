import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { gsap } from 'gsap';
import { Home, Library, Search, Settings, Download, Loader2, Menu, X, ChevronLeft } from 'lucide-react';
import { musicService } from './services/api';
import { getUserMetadata, logout, supabase, updateMetadata } from './services/supabase';
import { useTheme } from './services/ThemeContext';
import { usePlayerStore } from './stores/playerStore';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useMediaSession } from './hooks/useMediaSession';
import { fallbackSongs } from './data/fallbackSongs';
import { normalizeSongs } from './data/songCatalog';
import { BrandLogo } from './components/BrandLogo';
import { MiniPlayer } from './components/MiniPlayer';
import { NowPlayingFull } from './components/NowPlayingFull';
import { PageTransition } from './components/PageTransition';
import { AmbientScene } from './components/AmbientScene';
import { PlaylistPicker } from './components/PlaylistPicker';
import { DownloadPicker } from './components/DownloadPicker';
import Welcome from './pages/Welcome';
import SetupProfile from './pages/SetupProfile';
import HomeView from './pages/HomeView';
import SearchView from './pages/SearchView';
import LibraryView from './pages/LibraryView';
import SettingsTab from './pages/SettingsTab';
import DownloadsView from './pages/DownloadsView';

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/downloads', label: 'Offline', icon: Download },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function FloatingNav({ location }) {
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const mainContent = document.querySelector('.app-main');
      if (mainContent) {
        setScrolled(mainContent.scrollTop > 20);
      } else {
        setScrolled(window.scrollY > 20);
      }
    };
    
    const mainContent = document.querySelector('.app-main');
    if (mainContent) {
      mainContent.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      if (mainContent) {
        mainContent.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Close menu when location changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  return (
    <>
      <nav className={`global-nav ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="global-nav__logo">
          <BrandLogo size={24} showWordmark={true} color="var(--text-main)" />
        </div>
        
        {/* Desktop Links */}
        <div className="global-nav__links desktop-only">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to} className={`nav-link ${active ? 'active' : ''}`}>
                {item.label}
              </Link>
            );
          })}
        </div>
        
        <div className="global-nav__actions">
          {/* Android Back Button — mobile only */}
          <button
            type="button"
            className="mobile-only icon-btn"
            style={{ width: '40px', height: '40px', background: 'transparent', border: 'none', boxShadow: 'none', marginRight: '4px' }}
            onClick={() => window.history.back()}
            aria-label="Go back"
          >
            <ChevronLeft size={26} />
          </button>

          {/* Mobile Menu Toggle */}
          <button 
            type="button" 
            className="mobile-menu-toggle mobile-only"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            className="mobile-menu-overlay"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className="mobile-menu-content">
              {navItems.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <Link 
                    key={item.to} 
                    to={item.to} 
                    className={`mobile-nav-link ${active ? 'active' : ''}`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function normalizeHomeSections(sections = []) {
  return sections.map((section) => ({
    ...section,
    items: section.items.map((item) => (
      item.type === 'song' || item.type === 'video'
        ? normalizeSongs([item])[0]
        : item
    )),
  }));
}

function isPlayableTrack(item) {
  const type = item?.type?.toLowerCase();
  return type === 'song' || type === 'video' || Boolean(item?.videoId && String(item.videoId).length === 11);
}

function getCollectionTarget(item) {
  if (!item) return null;
  const type = item.type?.toLowerCase();
  const id = item.playlistId || item.albumId || item.artistId || item.browseId || item.id;
  if (!id) return null;

  if (item.playlistId || type === 'playlist' || String(id).startsWith('VL') || String(id).startsWith('PL')) {
    return { kind: 'playlist', targetId: item.playlistId || id };
  }
  if (item.albumId || type === 'album' || String(id).startsWith('MPRE')) {
    return { kind: 'album', targetId: item.albumId || item.browseId || id };
  }
  if (item.artistId || type === 'artist') {
    return { kind: 'artist', targetId: item.artistId || item.browseId || id };
  }
  return null;
}

const App = () => {
  const { updateTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isHomeLoading, setIsHomeLoading] = useState(false);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [songs, setSongs] = useState([]);
  const [homeSections, setHomeSections] = useState([]);
  const [moodSections, setMoodSections] = useState([]);
  const [authView, setAuthView] = useState(null);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1100);
  const navigate = useNavigate();
  const location = useLocation();

  const { audioRef, seek } = useAudioEngine();

  // Handle system back button for closing the player
  useEffect(() => {
    const handlePopState = () => {
      setNowPlayingOpen(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openPlayer = useCallback(() => {
    if (!nowPlayingOpen) {
      window.history.pushState({ player: 'open' }, '');
      setNowPlayingOpen(true);
    }
  }, [nowPlayingOpen]);

  const closePlayer = useCallback(() => {
    if (nowPlayingOpen) {
      if (window.history.state?.player === 'open') {
        window.history.back();
      }
      setNowPlayingOpen(false);
    }
  }, [nowPlayingOpen]);
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const loadQueueAndPlay = usePlayerStore((state) => state.loadQueueAndPlay);
  const playWithAlgorithm = usePlayerStore((state) => state.playWithAlgorithm);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const playNext = usePlayerStore((state) => state.playNext);
  const playPrev = usePlayerStore((state) => state.playPrev);
  const activeMood = usePlayerStore((state) => state.activeMood);
  const setActiveMood = usePlayerStore((state) => state.setActiveMood);

  useMediaSession();

  const loadHome = useCallback(async (mood = 'default') => {
    setIsHomeLoading(true);
    try {
      const data = await musicService.getHome(mood);
      const chartSongs = normalizeSongs(data?.charts?.length ? data.charts : fallbackSongs);
      setSongs(chartSongs);
      setHomeSections(normalizeHomeSections(data?.sections || []));
      setMoodSections(data?.moods || []);
    } catch (error) {
      console.error('Home unavailable, using fallback songs:', error);
      setSongs(normalizeSongs(fallbackSongs));
      setHomeSections([]);
      setMoodSections([]);
    } finally {
      setIsHomeLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent shortcut if user is typing in a text field
      if (
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault(); // Prevent page scrolling on space
        togglePlay();
      } else if (e.code === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
        playNext();
      } else if (e.code === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
        playPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, playNext, playPrev]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1100);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let initialLoadDone = false;

    const initApp = async () => {
      const safetyTimeout = setTimeout(() => setLoading(false), 5000);
      try {
        const isDev = window.localStorage.getItem('dev_user') === 'true';
        if (isDev) {
          const cachedMeta = window.localStorage.getItem('dev_metadata');
          const devMeta = cachedMeta ? JSON.parse(cachedMeta) : { username: 'dev_guest', theme: 'white', downloadPref: 'ask' };
          setUser({ id: 'dev-user-id', displayName: 'Dev User' });
          setMetadata(devMeta);
          if (!initialLoadDone) {
            initialLoadDone = true;
            await loadHome(activeMood);
          }
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUser = sessionData?.session?.user || null;
        setUser(sessionUser);

        if (sessionUser) {
          const meta = await getUserMetadata(sessionUser.id);
          if (meta) setMetadata(meta);
        }
        if (!initialLoadDone) {
          initialLoadDone = true;
          await loadHome(activeMood);
        }
      } catch (error) {
        console.error('App init error:', error);
      } finally {
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    };

    initApp();

    const { data: authData } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (window.localStorage.getItem('dev_user') === 'true') {
        return;
      }

      const sessionUser = session?.user || null;
      
      // If logging out, clear everything
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setMetadata(null);
        return;
      }

      setUser(sessionUser);
      if (sessionUser) {
        const meta = await getUserMetadata(sessionUser.id);
        if (meta) {
          setMetadata(meta);
          // Only load home if we haven't already or if it's a new sign in
          if (event === 'SIGNED_IN' && !initialLoadDone) {
            initialLoadDone = true;
            await loadHome(activeMood);
          }
        }
      }
    });

    return () => authData?.subscription?.unsubscribe();
  }, [loadHome]);

  const playSong = useCallback((song, queue = songs, isDiscovery = false) => {
    if (!song) return;
    if (!isPlayableTrack(song)) {
      console.warn('Ignoring non-track item passed to playSong:', song);
      return;
    }

    // Check if we're already playing this exact song
    const isSameSong = currentSong?.id === (song.browseId || song.id);
    
    if (isSameSong) {
      openPlayer();
      return;
    }
    
    // ALGORITHMIC PLAY: For discovery (search/home/hero), use YouTube Music's
    // recommendation algorithm to build the queue — NOT the search results.
    if (isDiscovery) {
      const normalizedSong = normalizeSongs([song])[0];
      if (normalizedSong) {
        playWithAlgorithm(normalizedSong);
        openPlayer();
      }
      return;
    }
    
    // COLLECTION PLAY: For albums/playlists, use the provided queue (intentional order)
    const normalizedQueue = normalizeSongs(queue?.length ? queue : [song]);
    const startSong = normalizedQueue.find((entry) => entry.id === song.id) || normalizeSongs([song])[0];
    if (!startSong) return;
    loadQueueAndPlay(normalizedQueue, startSong);
    openPlayer();
  }, [loadQueueAndPlay, playWithAlgorithm, songs, currentSong, openPlayer]);

  const playCollection = useCallback(async (item) => {
    if (!item) return;

    const target = getCollectionTarget(item);
    if (!target) return;

    setCollectionLoading(true);
    try {
      const resolved = await musicService.resolveCollection(target.kind, target.targetId);
      const tracks = normalizeSongs(resolved?.tracks || []);
      if (!tracks.length) return;
      loadQueueAndPlay(tracks, tracks[0]);
      openPlayer();
    } catch (error) {
      console.error('Collection playback failed:', error);
    } finally {
      setCollectionLoading(false);
    }
  }, [loadQueueAndPlay, openPlayer]);

  const handleLogout = async () => {
    window.localStorage.removeItem('dev_user');
    await logout();
    window.location.reload();
  };

  const updateMetadataState = useCallback(async (newData) => {
    if (!newData) return;
    setMetadata((prev) => ({ ...prev, ...newData }));
    try {
      if (user && !window.localStorage.getItem('dev_user')) {
        await updateMetadata(user.id, newData);
      } else if (window.localStorage.getItem('dev_user')) {
        const currentDevMeta = JSON.parse(window.localStorage.getItem('dev_metadata') || '{}');
        window.localStorage.setItem('dev_metadata', JSON.stringify({ ...currentDevMeta, ...newData }));
      }
    } catch (error) {
      console.error('Failed to persist metadata:', error);
    }
  }, [user]);

  return (
    <div className="app-container">
      <AmbientScene />

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="boot-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(20px)' }}
            transition={{ duration: 0.8 }}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}
          >
            <BrandLogo size={60} color="var(--text-main)" />
          </motion.div>
        ) : !user ? (
          <motion.div key="auth-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {authView ? (
              <Welcome initialMode={authView} />
            ) : (
              <Welcome initialMode="landing" />
            )}
          </motion.div>
        ) : !metadata ? (
          <motion.div key="setup-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SetupProfile userId={user.id} onComplete={async () => {
              const meta = await getUserMetadata(user.id);
              if (meta) setMetadata(meta);
            }} />
          </motion.div>
        ) : (
          <motion.div
            key="app-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <FloatingNav location={location} />

            <AnimatePresence>
              {collectionLoading && (
                <motion.div
                  initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                  animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
                  exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                  style={{
                    position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', 
                    alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)'
                  }}
                >
                  <motion.div 
                    initial={{ scale: 0.9, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 10 }}
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--glass-border)',
                      padding: '32px 48px', borderRadius: '24px', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: '16px', boxShadow: 'var(--glass-shadow)'
                    }}
                  >
                    <Loader2 size={40} className="spin" color="var(--accent)" />
                    <div style={{ textAlign: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#fff' }}>Loading Collection</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>Fetching high-quality audio...</p>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <main className="view-padding">
              <AnimatePresence mode="wait">
                <PageTransition routeKey={location.pathname}>
                  <Routes location={location}>
                    <Route
                      path="/"
                      element={
                        <HomeView
                          songs={songs}
                          sections={homeSections}
                          moods={moodSections}
                          onPlay={playSong}
                          onPlayCollection={playCollection}
                          metadata={metadata}
                          activeMood={activeMood}
                          onMoodChange={(mood) => { setActiveMood(mood); loadHome(mood); }}
                          currentSong={currentSong}
                          isPlaying={isPlaying}
                          isLoading={isHomeLoading}
                        />
                      }
                    />
                    <Route path="/search" element={<SearchView songs={songs} onPlay={playSong} onPlayCollection={playCollection} currentSong={currentSong} isPlaying={isPlaying} metadata={metadata} />} />
                    <Route path="/library" element={<LibraryView songs={songs} onPlay={playSong} />} />
                    <Route path="/downloads" element={<DownloadsView onPlay={playSong} />} />
                    <Route path="/settings" element={<SettingsTab metadata={metadata} onUpdateMetadata={updateMetadataState} onLogout={handleLogout} />} />
                  </Routes>
                </PageTransition>
              </AnimatePresence>
            </main>

            {/* MiniPlayer persists across ALL pages while music is playing */}
            <PlaylistPicker />
            <DownloadPicker />
            <MiniPlayer onExpand={openPlayer} isMobile={isMobile} />
            <AnimatePresence>
              {nowPlayingOpen ? (
                <NowPlayingFull 
                  audioRef={audioRef} 
                  onClose={closePlayer} 
                  onSeek={seek} 
                  metadata={metadata} 
                />
              ) : null}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlays outside route transitions — always available */}
    </div>
  );
};

export default App;
