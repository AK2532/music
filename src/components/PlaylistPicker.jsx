import { useState } from 'react';
import { Plus, ListMusic, CheckCircle2 } from 'lucide-react';
import { Modal } from './Modal';
import { usePlayerStore } from '../stores/playerStore';

export function PlaylistPicker() {
  const isOpen = usePlayerStore(state => state.isPlaylistPickerOpen);
  const song = usePlayerStore(state => state.songToAddToPlaylist);
  const closePicker = usePlayerStore(state => state.closePlaylistPicker);
  const playlists = usePlayerStore(state => state.playlists);
  const addToPlaylist = usePlayerStore(state => state.addToPlaylist);
  const createPlaylist = usePlayerStore(state => state.createPlaylist);
  
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [addedTo, setAddedTo] = useState(null);

  if (!song) return null;

  const handleAdd = (playlistId) => {
    addToPlaylist(playlistId, song);
    setAddedTo(playlistId);
    setTimeout(() => {
      setAddedTo(null);
      closePicker();
    }, 1500);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const id = createPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setShowCreate(false);
    handleAdd(id);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={closePicker} 
      title="Add to Playlist"
    >
      <div className="playlist-picker">
        <div className="picker-song-preview">
          <img src={song.thumbnail} alt="" />
          <div>
            <strong>{song.title}</strong>
            <small>{song.artist}</small>
          </div>
        </div>

        <div className="picker-list hide-scrollbar">
          {playlists.length === 0 && !showCreate && (
            <div className="picker-empty">
              <ListMusic size={40} />
              <p>No playlists found</p>
            </div>
          )}
          
          {playlists.map(pl => {
            const isAdded = addedTo === pl.id;
            return (
              <button 
                key={pl.id} 
                className={`picker-item ${isAdded ? 'is-added' : ''}`}
                onClick={() => handleAdd(pl.id)}
                disabled={isAdded}
              >
                <ListMusic size={20} />
                <span>{pl.name}</span>
                {isAdded && <CheckCircle2 size={18} className="success-icon" />}
              </button>
            );
          })}
        </div>

        {!showCreate ? (
          <button className="picker-create-trigger" onClick={() => setShowCreate(true)}>
            <Plus size={18} />
            New Playlist
          </button>
        ) : (
          <form className="picker-create-form" onSubmit={handleCreate}>
            <input 
              autoFocus
              type="text" 
              placeholder="Playlist name..." 
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
            />
            <div className="picker-form-actions">
              <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn-save">Create & Add</button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
