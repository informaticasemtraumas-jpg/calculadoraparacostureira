window.SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  anonKey: 'YOUR_SUPABASE_ANON_KEY'
};

window.createSupabaseClient = function createSupabaseClient() {
  if (!window.supabase || !window.supabase.createClient) {
    console.warn('Supabase SDK não carregado.');
    return null;
  }

  const { url, anonKey } = window.SUPABASE_CONFIG;
  if (!url || !anonKey || url.includes('YOUR_PROJECT_REF') || anonKey.includes('YOUR_SUPABASE_ANON_KEY')) {
    console.warn('Configure SUPABASE_CONFIG em supabase.js com URL e anon key válidas.');
    return null;
  }

  return window.supabase.createClient(url, anonKey);
};
