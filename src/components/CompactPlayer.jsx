import React from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart } from 'lucide-react';
import { usePlayerStore } from '../stores/playerStore';

export const CompactPlayer = () => {
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const playNext = usePlayerStore((state) => state.playNext);
  const playPrev = usePlayerStore((state) => state.playPrev);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat);
  const likedIds = usePlayerStore((state) => state.likedIds);
  const toggleLike = usePlayerStore((state) => state.toggleLike);

  if (!currentSong) {
    return (
      <div className="player-card glass-card">
        <div className="song-details">
          <h3>No song playing</h3>
          <p>Select a track to start listening</p>
        </div>
      </div>
    );
  }

  const progress = (currentTime / duration) * 100 || 0;

  return (
    <div className="player-card glass-card">
      <div className="player-info">
        <div className="song-details">
          <h3>{currentSong.title}</h3>
          <p>{currentSong.artist} • {currentSong.album?.name || 'Unknown Album'}</p>
        </div>
        <button 
          className="control-btn" 
          onClick={() => toggleLike(currentSong.id)}
          style={{ color: likedIds.has(currentSong.id) ? '#4facfe' : 'rgba(255,255,255,0.5)' }}
        >
          <Heart size={24} fill={likedIds.has(currentSong.id) ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="dash-seek-bar">
        <div className="dash-seek-progress" style={{ width: `${progress}%` }}></div>
        <div className="dash-seek-handle" style={{ left: `${progress}%` }}></div>
      </div>

      <div className="player-controls-row">
        <button className="control-btn" onClick={toggleShuffle}>
          <Shuffle size={20} />
        </button>
        <button className="control-btn" onClick={playPrev}>
          <SkipBack size={24} />
        </button>
        <button className="control-btn play-pause-btn" onClick={togglePlay}>
          {isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" style={{ marginLeft: 4 }} />}
        </button>
        <button className="control-btn" onClick={playNext}>
          <SkipForward size={24} />
        </button>
        <button className="control-btn" onClick={cycleRepeat}>
          <Repeat size={20} />
        </button>
      </div>
    </div>
  );
};
