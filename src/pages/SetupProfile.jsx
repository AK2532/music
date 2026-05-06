import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { saveUserProfile } from '../services/supabase';
import { BrandLogo } from '../components/BrandLogo';

const SetupProfile = ({ userId, onComplete }) => {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleApply = async (candidate = username) => {
    const normalized = candidate.trim();

    if (normalized.length < 2) {
      setStatus('short');
      return;
    }

    setLoading(true);
    setStatus('checking');
    setErrorMsg('');

    const applyTimeout = setTimeout(() => {
      setLoading(false);
      setStatus('error');
      setErrorMsg('Saving timed out. Try again or refresh.');
    }, 10000);

    try {
      await saveUserProfile(userId, {
        username: normalized,
        downloadPref: 'ask',
        theme: 'white',
      });
      clearTimeout(applyTimeout);
      onComplete();
    } catch (err) {
      console.error('Profile Setup Error:', err);
      setStatus('error');
      setErrorMsg(err.message || 'Failed to save profile. Check connection.');
      clearTimeout(applyTimeout);
    } finally {
      setLoading(false);
    }
  };

  const helperMessage = status === 'short'
    ? 'Name must be at least 2 characters.'
    : status === 'error'
      ? errorMsg
      : 'Pick a short tag you will recognize anywhere in the app.';

  return (
    <div className="auth-shell auth-shell--profile">
      <div className="app-background" aria-hidden="true">
        <div className="auth-sweep auth-sweep--one" />
        <div className="auth-sweep auth-sweep--two" />
        <div className="auth-grid" />
      </div>

      <div className="auth-card auth-card--form auth-card--profile">
        <div className="auth-card__header auth-card__header--center">
          <BrandLogo size={60} />
          <div className="label-mono">Profile setup</div>
          <h2 className="auth-card__title">Choose your tag</h2>
          <p className="auth-card__subtitle">This becomes your visible identity across the player, library, and settings.</p>
        </div>

        <div className="form-grid">
          <div>
            <label className="form-label" htmlFor="profile-username">Username</label>
            <input
              id="profile-username"
              type="text"
              placeholder="e.g. adarsh_music"
              className="auth-input"
              value={username}
              onChange={(event) => setUsername(event.target.value.replace(/[^a-z0-9_]/gi, ''))}
            />
          </div>
          <div className={status === 'error' || status === 'short' ? 'form-error' : 'form-helper'}>
            {helperMessage}
          </div>
        </div>

        <button type="button" onClick={() => handleApply()} disabled={loading} className="button-primary auth-wide-button">
          {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowRight size={16} />}
          {loading ? 'Saving profile...' : 'Confirm identity'}
        </button>
      </div>
    </div>
  );
};

export default SetupProfile;
