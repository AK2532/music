import { motion } from 'framer-motion';
import { useTheme } from '../services/ThemeContext';

const ThemeTab = () => {
  const { theme, themes, updateTheme } = useTheme();

  return (
    <div className="view-wrap">
      <div className="hud-glass noise premium-hero">
        <div style={{ display: 'grid', gap: 18 }}>
          <p className="eyebrow">Theme palette</p>
          <h2 className="hero-title">
            Shift the mood,
            <br />
            <span className="text-accent-gradient">keep the structure.</span>
          </h2>
          <p className="hero-copy" style={{ maxWidth: 620 }}>
            Accent themes now drive the full interface token set instead of changing one isolated color variable.
          </p>
        </div>
      </div>

      <div className="song-grid">
        {Object.entries(themes).map(([name, palette], index) => (
          <motion.button
            key={name}
            type="button"
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="choice-card hud-glass"
            data-active={theme === name}
            onClick={() => updateTheme(name)}
            style={{ padding: 22, display: 'grid', gap: 14, textAlign: 'left' }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ width: 42, height: 42, borderRadius: 16, background: palette.accent, display: 'inline-block' }} />
              <span style={{ width: 42, height: 42, borderRadius: 16, background: palette.accent2, display: 'inline-block' }} />
            </div>
            <div>
              <div className="choice-card__title">{palette.label}</div>
              <div className="choice-card__copy">{name}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default ThemeTab;
