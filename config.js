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
                supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            }
        } catch (e) {
            console.error('Failed to initialize Supabase client:', e);
        }
    }
    return supabaseClient;
}

// Centralized Backend Gemini API Key Configuration
// You can set your single shared Gemini API Key here or in api/chat.js / api/chat.php
const BACKEND_GEMINI_API_KEY = window.ENV_GEMINI_API_KEY || localStorage.getItem('scholarmate_gemini_key') || 'AQ.Ab8RN6JjfpyDUJWa1gAgGTr7nnfvSc6rE0-Zjm1AYhhEOqQnzw';

function getGeminiApiKey() {
    const key = window.GEMINI_API_KEY || localStorage.getItem('scholarmate_gemini_key') || window.ENV_GEMINI_API_KEY || (BACKEND_GEMINI_API_KEY !== 'AQ.Ab8RN6JjfpyDUJWa1gAgGTr7nnfvSc6rE0-Zjm1AYhhEOqQnzw' ? BACKEND_GEMINI_API_KEY : '') || '';
    return key;
}

function setGeminiApiKey(key) {
    const cleanKey = (key || '').trim();
    if (cleanKey) {
        localStorage.setItem('scholarmate_gemini_key', cleanKey);
    } else {
        localStorage.removeItem('scholarmate_gemini_key');
    }
    window.GEMINI_API_KEY = cleanKey;
    return cleanKey;
}

const GEMINI_API_KEY = getGeminiApiKey();
window.GEMINI_API_KEY = GEMINI_API_KEY;
window.getGeminiApiKey = getGeminiApiKey;
window.setGeminiApiKey = setGeminiApiKey;
window.getSupabase = getSupabase;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
