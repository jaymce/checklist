// Both of these are PUBLIC values, safe to commit and safe to ship in a
// browser. They identify which Supabase project to talk to -- they don't
// grant any access by themselves. Actual protection comes from the Row
// Level Security policies on the database (see supabase/migrations/), which
// Supabase enforces no matter what a visitor's browser sends.
//
// Never put a `service_role` / `secret` key here or anywhere in frontend
// code -- that one actually does bypass Row Level Security.
export const SUPABASE_URL = 'https://qgchmtfzlerdujzsfabq.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_IaSEWaKGH6N5B2R1nPBLsg_T0gj4wHH';
