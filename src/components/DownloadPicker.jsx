import { Modal } from './Modal';
import { HardDrive, Smartphone, Download, Trash2 } from 'lucide-react';
import { usePlayerStore } from '../stores/playerStore';
import { musicService } from '../services/api';

export function DownloadPicker() {
  const isOpen = usePlayerStore(state => state.isDownloadPickerOpen);
  const song = usePlayerStore(state => state.songToDownload);
  const close = usePlayerStore(state => state.closeDownloadPicker);
  const recordDownload = usePlayerStore(state => state.recordDownload);
  const removeDownload = usePlayerStore(state => state.removeDownload);
  const downloads = usePlayerStore(state => state.downloads);

  if (!song) return null;

  const isDownloadedInApp = downloads.some(d => d.id === song.id);

  const saveToDevice = () => {
    const link = document.createElement('a');
    link.href = musicService.getDownloadUrl(song.id, `${song.title} - ${typeof song.artist === 'object' ? song.artist.name : song.artist}`);
    link.download = `${song.title}.m4a`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const saveInApp = () => {
    recordDownload({ ...song, localStatus: 'downloaded' });
  };

  const handleSelect = (destination) => {
    if (destination === 'app' || destination === 'both') saveInApp();
    if (destination === 'storage' || destination === 'both') saveToDevice();
    if (destination === 'remove') removeDownload(song.id);
    close();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={close} 
      title="Download Options"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: '0 0 8px 0' }}>{isDownloadedInApp ? 'Manage downloads for' : 'Where would you like to save'} "{song.title}"?</p>
        
        {isDownloadedInApp ? (
          <button className="picker-item" onClick={() => handleSelect('remove')} style={{ textAlign: 'left', width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '16px', color: '#ff4d4d' }}>
            <Trash2 size={24} style={{ color: '#ff4d4d' }} />
            <div>
              <strong style={{ display: 'block', fontSize: '1rem' }}>Remove from App</strong>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255, 77, 77, 0.7)' }}>Delete from offline library</span>
            </div>
          </button>
        ) : (
          <button className="picker-item" onClick={() => handleSelect('app')} style={{ textAlign: 'left', width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '16px', color: '#fff' }}>
            <Smartphone size={24} style={{ color: 'var(--accent)' }} />
            <div>
              <strong style={{ display: 'block', fontSize: '1rem' }}>Save in App</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Keep it in your offline library</span>
            </div>
          </button>
        )}

        <button className="picker-item" onClick={() => handleSelect('storage')} style={{ textAlign: 'left', width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '16px', color: '#fff' }}>
          <HardDrive size={24} style={{ color: 'var(--accent)' }} />
          <div>
            <strong style={{ display: 'block', fontSize: '1rem' }}>Save to Device</strong>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Export to phone storage (M4A)</span>
          </div>
        </button>

        {!isDownloadedInApp && (
          <button className="picker-item" onClick={() => handleSelect('both')} style={{ textAlign: 'left', width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '16px', color: '#fff' }}>
            <Download size={24} style={{ color: 'var(--accent)' }} />
            <div>
              <strong style={{ display: 'block', fontSize: '1rem' }}>Save Both</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>In-app & Local storage</span>
            </div>
          </button>
        )}
      </div>
    </Modal>
  );
}
