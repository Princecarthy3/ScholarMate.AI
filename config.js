/**
 * SCHOLARMATE AI - CONFIGURATION & SUPABASE INITIALIZATION
 * 
 * Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project credentials from:
 * Supabase Dashboard -> Project Settings -> API
 */

const SUPABASE_URL = window.ENV_SUPABASE_URL || 'https://jvaggclfzufzspshwemo.supabase.co';
const SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2YWdnY2xmenVmenNwc2h3ZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MzQ3ODMsImV4cCI6MjEwMzUxMDc4M30.rwmnaki5W8OwtZFD9URohTcJ9nbgAHDRp8tTk-XrWAY';

let supabaseClient = null;

function getSupabase() {
    if (supabaseClient) return supabaseClient;

    if (window.supabase && typeof window.supabase.createClient === 'function') {
        try {
            if (SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('YOUR_SUPABASE')) {
                supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                    auth: {
                        autoRefreshToken: true,
                        persistSession: true,
                        detectSessionInUrl: true,
                        flowType: 'implicit'
                    }
                });
            }
        } catch (e) {
            console.error('Failed to initialize Supabase client:', e);
        }
    }
    return supabaseClient;
}

// OpenRouter is configured on the backend only.
// Do NOT put the OpenRouter secret key in this browser-side file.
// Vercel: set OPENROUTER_API_KEY in Project Settings -> Environment Variables.
// XAMPP/PHP: set OPENROUTER_API_KEY as a server environment variable, or configure
// the placeholder in api/chat-local.php for local development only.
const OPENROUTER_MODEL = 'google/gemma-4-31b-it:free';
const OPENROUTER_FALLBACK_MODEL = 'google/gemma-4-26b-a4b-it:free';

window.OPENROUTER_MODEL = OPENROUTER_MODEL;
window.OPENROUTER_FALLBACK_MODEL = OPENROUTER_FALLBACK_MODEL;
