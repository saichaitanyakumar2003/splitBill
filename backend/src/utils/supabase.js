const { createClient } = require('@supabase/supabase-js');

let supabase = null;

function initSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized');
    return true;
  }
  
  console.log('⚠️ Supabase not configured - using in-memory storage');
  return false;
}

function getSupabase() {
  if (supabase === null) {
    initSupabase();
  }
  return supabase;
}

module.exports = { getSupabase, initSupabase };

