(function initSupabaseClient(global) {
  const env = global.__SUPABASE_ENV__ || {};
  const SUPABASE_URL = env.SUPABASE_URL || global.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || global.SUPABASE_ANON_KEY || '';

  const hasConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  const supabase = hasConfig && global.supabase
    ? global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  global.AppSupabase = {
    supabase,
    hasConfig
  };
})(window);
