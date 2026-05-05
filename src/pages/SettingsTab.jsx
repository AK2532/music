import { Download, LogOut, Moon, Palette, Sparkles, Waves } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { useTheme } from '../services/ThemeContext';

/* Helper: renders a pill button that uses the theme's accent when active */
function OptionPill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 20px',
        borderRadius: '999px',
        background: active ? 'var(--btn-primary-bg)' : 'var(--btn-secondary-bg)',
        border: `1px solid ${active ? 'var(--btn-primary-bg)' : 'var(--btn-secondary-border)'}`,
        color: active ? 'var(--btn-primary-text)' : 'var(--text-main)',
        fontSize: '14px',
        fontWeight: 600,
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        boxShadow: active ? '0 0 18px var(--accent-glow)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--hover-bg)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--btn-secondary-bg)';
      }}
    >
      {label}
    </button>
  );
}

/* Divider using theme border color */
function Divider() {
  return <div style={{ height: 1, background: 'var(--border-subtle)' }} />;
}

const SettingsTab = ({ metadata, onUpdateMetadata, onLogout }) => {
  const { theme, themes, updateTheme } = useTheme();
  const [clock, setClock] = useState(() => Date.now());

  const lyricsProvider = usePlayerStore((state) => state.lyricsProvider);
  const sleepTimer = usePlayerStore((state) => state.sleepTimer);
  const audioQuality = usePlayerStore((state) => state.audioQuality);

  const setLyricsProvider = usePlayerStore((state) => state.setLyricsProvider);
  const setSleepTimer = usePlayerStore((state) => state.setSleepTimer);
  const setAudioQuality = usePlayerStore((state) => state.setAudioQuality);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingMinutes = useMemo(() => {
    if (!sleepTimer) return null;
    return Math.max(0, Math.round((sleepTimer - clock) / 60000));
  }, [clock, sleepTimer]);

  const handleThemeChange = async (themeName) => {
    updateTheme(themeName);
    await onUpdateMetadata({ ...metadata, theme: themeName });
  };

  const sectionStyle = {
    background: 'var(--card-bg)',
    border: '1px solid var(--glass-border)',
    borderRadius: '20px',
    padding: '28px 32px',
    display: 'grid',
    gap: '28px',
    backdropFilter: 'blur(24px)',
  };

  const sectionLabelStyle = {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
    margin: 0,
  };

  const rowLabelStyle = {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-main)',
    marginBottom: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    letterSpacing: '-0.01em',
  };

  return (
    <div style={{
      display: 'grid',
      gap: '36px',
      paddingBottom: '64px',
      maxWidth: '800px',
      margin: '0 auto',
      fontFamily: 'var(--font-body, "Inter", sans-serif)',
    }}>

      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '28px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={sectionLabelStyle}>System Profile</p>
          <h1 style={{
            fontSize: 'clamp(28px, 5vw, 40px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
            color: 'var(--text-main)',
            margin: 0,
          }}>
            @{metadata.username || 'guest'}
          </h1>
        </div>
        <button
          type="button"
          onClick={onLogout}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '12px',
            background: 'var(--btn-secondary-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-main)',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--hover-bg)';
            e.currentTarget.style.borderColor = 'var(--glass-border)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--btn-secondary-bg)';
            e.currentTarget.style.borderColor = 'var(--glass-border)';
          }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </header>

      {/* ── Theme Picker ──────────────────────────── */}
      <section>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Palette size={14} color="var(--accent)" />
          <h3 style={sectionLabelStyle}>Appearance</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px' }}>
          {Object.entries(themes).map(([name, palette]) => {
            const isActive = theme === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => handleThemeChange(name)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '16px',
                  border: `2px solid ${isActive ? palette.accent : 'transparent'}`,
                  background: palette.bg,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  textAlign: 'left',
                  boxShadow: isActive ? `0 0 24px rgba(${palette.accent.replace('#','').match(/.{2}/g).map(h=>parseInt(h,16)).join(', ')}, 0.35)` : '0 4px 16px rgba(0,0,0,0.3)',
                  outline: 'none',
                }}
              >
                {/* Surface preview bar */}
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  {/* Accent dot */}
                  <span style={{ width: 26, height: 26, borderRadius: '50%', background: palette.accent, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 10px ${palette.accent}88` }} />
                  {/* Accent2 dot */}
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: palette.accent2, display: 'inline-block', flexShrink: 0 }} />
                  {/* Surface bar */}
                  <span style={{ flex: 1, height: 8, borderRadius: '4px', background: palette.surface, display: 'inline-block' }} />
                </div>
                {/* Theme name */}
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: palette.text, letterSpacing: '-0.01em' }}>{palette.label}</div>
                  {isActive && (
                    <div style={{ fontSize: '11px', color: palette.accent, marginTop: '2px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Active</div>
                  )}
                </div>
                {/* Active indicator dot */}
                {isActive && (
                  <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: palette.accent, boxShadow: `0 0 8px ${palette.accent}` }} />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Services & Quality ────────────────────── */}
      <section>
        <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={14} color="var(--accent)" />
          <h3 style={sectionLabelStyle}>Services &amp; Quality</h3>
        </div>
        <div style={sectionStyle}>

          {/* Lyrics Provider */}
          <div>
            <div style={rowLabelStyle}><Sparkles size={16} opacity={0.7} /> Lyrics Provider</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                { id: 'lrclib', label: 'LRCLIB (Recommended)' },
                { id: 'ytmusic', label: 'YouTube Music' },
              ].map((option) => (
                <OptionPill
                  key={option.id}
                  label={option.label}
                  active={lyricsProvider === option.id}
                  onClick={() => setLyricsProvider(option.id)}
                />
              ))}
            </div>
          </div>

          <Divider />

          {/* Download Destination */}
          <div>
            <div style={rowLabelStyle}><Download size={16} opacity={0.7} /> Download Destination</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                { id: 'ask', label: 'Ask every time' },
                { id: 'app', label: 'In-app only' },
                { id: 'storage', label: 'Device only' },
                { id: 'both', label: 'Both' },
              ].map((option) => (
                <OptionPill
                  key={option.id}
                  label={option.label}
                  active={metadata.downloadPref === option.id}
                  onClick={() => onUpdateMetadata({ ...metadata, downloadPref: option.id })}
                />
              ))}
            </div>
          </div>

          <Divider />

          {/* Audio Quality */}
          <div>
            <div style={rowLabelStyle}><Waves size={16} opacity={0.7} /> Audio Quality</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                { id: 'low', label: 'Data Saver' },
                { id: 'balanced', label: 'Balanced' },
                { id: 'high', label: 'High Quality' },
              ].map((option) => (
                <OptionPill
                  key={option.id}
                  label={option.label}
                  active={audioQuality === option.id}
                  onClick={() => setAudioQuality(option.id)}
                />
              ))}
            </div>
          </div>

          <Divider />

          {/* Sleep Timer */}
          <div>
            <div style={rowLabelStyle}><Moon size={16} opacity={0.7} /> Sleep Timer</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {[15, 30, 45, 60].map((minutes) => {
                const isActive = remainingMinutes !== null && Math.abs(remainingMinutes - minutes) <= 1;
                return (
                  <OptionPill
                    key={minutes}
                    label={`${minutes} min`}
                    active={isActive}
                    onClick={() => setSleepTimer(minutes)}
                  />
                );
              })}
              <OptionPill
                label="Off"
                active={!sleepTimer}
                onClick={() => setSleepTimer(null)}
              />
              {sleepTimer && (
                <span style={{ color: 'var(--text-muted)', fontSize: '13px', marginLeft: '4px', fontWeight: 500 }}>
                  Stops at {new Date(sleepTimer).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>

        </div>
      </section>

    </div>
  );
};

export default SettingsTab;
