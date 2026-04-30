/* =========================================
   auth.js — Supabase Client Singleton
   =========================================
   SETUP: Replace the two placeholders below
   with your actual values from:
   Supabase Dashboard → Project Settings → API
   ========================================= */

const SUPABASE_URL  = "https://cnwayoqepgdzdemewnax.supabase.co";
const SUPABASE_ANON = "sb_publishable_2VcaVAfgWYUOSyouAp6qhA_jOinte87";

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);