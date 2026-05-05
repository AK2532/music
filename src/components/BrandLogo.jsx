import { motion } from 'framer-motion';

export function BrandLogo({ size = 48, showWordmark = false }) {
  const markSize = size;
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div
        style={{
          width: markSize,
          height: markSize,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Core Glowing Orb */}
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.8, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: 'var(--accent)',
            filter: 'blur(12px)',
            opacity: 0.6,
          }}
        />

        {/* Outer Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.1)',
            borderTopColor: 'var(--accent)',
            borderRightColor: 'var(--accent-2)',
          }}
        />

        {/* Inner Glass Prism */}
        <div
          style={{
            width: '75%',
            height: '75%',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            boxShadow: 'inset 0 4px 10px rgba(255,255,255,0.1)',
          }}
        >
          {/* Abstract Waveform / A.K Symbol */}
          <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '40%' }}>
            <motion.div animate={{ height: ['40%', '100%', '40%'] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }} style={{ width: '4px', background: 'var(--accent)', borderRadius: '2px' }} />
            <motion.div animate={{ height: ['80%', '40%', '80%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} style={{ width: '4px', background: '#fff', borderRadius: '2px' }} />
            <motion.div animate={{ height: ['60%', '100%', '60%'] }} transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }} style={{ width: '4px', background: 'var(--accent-2)', borderRadius: '2px' }} />
          </div>
        </div>
      </div>

      {showWordmark ? (
        <div style={{ display: 'grid', gap: '2px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: Math.max(16, markSize * 0.4), fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1 }}>
            A.K MUSIC
          </div>
        </div>
      ) : null}
    </div>
  );
}
