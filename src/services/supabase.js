import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eknbbuxiabijnaohzrph.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrbmJidXhpYWJpam5hb2h6cnBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Mzc0NzgsImV4cCI6MjA5MjQxMzQ3OH0.h_aNVdzqGZBCpJB8RCxw0R6tP3cu9i6Q5F0koMms258'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const loginWithGoogle = async () => {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
  })
}

const normalizeUsername = (username) => username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
const usernameToEmail = (username, legacy = false) => `${normalizeUsername(username)}@${legacy ? 'akmusic.local' : 'akmusic.app'}`

export const loginWithUsernameAndPassword = async (username, password) => {
  const email = usernameToEmail(username)
  const result = await supabase.auth.signInWithPassword({ email, password })
  if (!result.error) return result

  // Backward compatibility for older local test accounts.
  const legacyEmail = usernameToEmail(username, true)
  if (legacyEmail !== email) {
    const legacyResult = await supabase.auth.signInWithPassword({ email: legacyEmail, password })
    if (!legacyResult.error) return legacyResult
  }
  return result
}

export const signUpWithUsernameAndPassword = async (username, password) => {
  const email = usernameToEmail(username)
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username: normalizeUsername(username) },
    },
  })
}

export const logout = async () => {
  return supabase.auth.signOut()
}

// Supabase 'liked_songs' table
export const addToLikedSongs = async (userId, song) => {
  const { data, error } = await supabase
    .from('liked_songs')
    .insert([{ user_id: userId, ...song }])
  if (error) throw error
  return data
}

export const getLikedSongs = async (userId) => {
  const { data, error } = await supabase
    .from('liked_songs')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return data
}

export const removeFromLikedSongs = async (userId, songId) => {
  const { error } = await supabase
    .from('liked_songs')
    .delete()
    .eq('user_id', userId)
    .eq('id', songId)
  if (error) throw error
}

// Supabase 'users_metadata' and 'usernames' tables
export const checkUsername = async (username) => {
  if (!username) return false;
  try {
    const { data, error } = await supabase
      .from('usernames')
      .select('username')
      .eq('username', username.toLowerCase())
      .maybeSingle()
    
    if (error) throw error;
    return !data; // If no data found, it's available
  } catch (error) {
    console.error("Username Check Error:", error);
    return true; // Default to available on error to prevent hanging the UI
  }
}

export const saveUserProfile = async (userId, data) => {
  // Save to local storage as primary source immediately
  localStorage.setItem(`metadata_${userId}`, JSON.stringify(data));
  
  // Perform database sync in the background without awaiting it
  // This prevents the UI from hanging if the connection is slow
  supabase.from('users_metadata')
    .upsert({ user_id: userId, ...data, updated_at: new Date() })
    .then(({ error }) => {
      if (!error) {
        supabase.from('usernames')
          .upsert({ username: data.username.toLowerCase(), user_id: userId })
          .then(({ error: usrErr }) => { if (usrErr) console.error(usrErr); });
      } else {
        console.error(error);
      }
    });

  return true; // Return true immediately to unblock the UI
}

export const getUserMetadata = async (userId) => {
  try {
    // Create a promise that rejects after 2 seconds
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("DB Timeout")), 2000)
    );

    // Race the database fetch against the timeout
    const { data, error } = await Promise.race([
      supabase.from('users_metadata').select('*').eq('user_id', userId).maybeSingle(),
      timeoutPromise
    ]);

    if (error) throw error;
    
    if (data) {
      localStorage.setItem(`metadata_${userId}`, JSON.stringify(data));
      return data;
    }
  } catch (error) {
    console.warn("Metadata unavailable; using local profile fallback.", error.message || error);
  }

  // Fallback to local storage
  const local = localStorage.getItem(`metadata_${userId}`);
  return local ? JSON.parse(local) : null;
}

export const updateMetadata = async (userId, updates) => {
  const { error } = await supabase
    .from('users_metadata')
    .update(updates)
    .eq('user_id', userId)
  if (error) throw error;
}
