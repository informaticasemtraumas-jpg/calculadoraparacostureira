window.SUPABASE_CONFIG = {
  url: 'https://bkknlkekthqbqwlxugpt.supabase.co',
  anonKey: 'sb_publishable_uszB3relRboXt1El2Li2tA_1Q6Jbxs0'
};

window.supabaseClient = null;

window.createSupabaseClient = function createSupabaseClient() {
  if (window.supabaseClient) return window.supabaseClient;

  if (!window.supabase || !window.supabase.createClient) {
    console.warn('Supabase SDK não carregado.');
    return null;
  }

  const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = window.SUPABASE_CONFIG;
  if (
    !SUPABASE_URL
    || !SUPABASE_ANON_KEY
    || SUPABASE_URL.includes('YOUR_PROJECT_REF')
    || SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')
  ) {
    console.warn('Configure SUPABASE_CONFIG em supabase.js com URL e anon key válidas.');
    return null;
  }

  const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  window.supabaseClient = supabaseClient;
  return window.supabaseClient;
};
