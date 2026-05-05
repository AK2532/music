import { Disc3, Loader2, Mic2, Music2, Play, Radio, Rows3 } from 'lucide-react';
import { useRef } from 'react';

const iconByType = {
  album: Disc3,
  artist: Mic2,
  playlist: Rows3,
  radio: Radio,
  collection: Music2,
};

export function BrowseCard({ item, onActivate, loading = false }) {
  const Icon = iconByType[item.type] || Music2;
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (y - centerY) / 10;
    const rotateY = (centerX - x) / 10;

    cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  };

  return (
    <div
      ref={cardRef}
      className="card-glass"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onActivate}
      style={{
        borderRadius: '24px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'transform 0.1s ease-out, background 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
        display: 'grid',
        gap: '16px'
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '16px', overflow: 'hidden' }}>
        <img 
          src={item.thumbnail} 
          alt={item.title} 
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }} 
          onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
        />
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 40%)',
        }} />

        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          padding: '6px 10px',
          borderRadius: '12px',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff',
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Icon size={12} color="var(--accent)" />
          {item.type}
        </div>
        
        <div style={{
          position: 'absolute',
          right: '12px',
          bottom: '12px',
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--glow-strong)',
          opacity: 0,
          transform: 'scale(0.8)',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.opacity = 1;
          e.currentTarget.style.transform = 'scale(1)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.opacity = 0;
          e.currentTarget.style.transform = 'scale(0.8)';
        }}
        >
          {loading ? <Loader2 size={20} color="#000" style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={20} fill="#000" style={{ marginLeft: 2 }} />}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '4px' }}>
        <div style={{ 
          fontWeight: 800, 
          fontSize: '15px', 
          color: '#fff',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {item.title}
        </div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.subtitle || item.description || 'Open collection'}
        </div>
      </div>
    </div>
  );
}
