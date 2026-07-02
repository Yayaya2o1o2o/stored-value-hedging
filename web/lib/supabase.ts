import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Public client for the profitability scenario store (RLS: public demo). */
export const supabase = createClient(url, key);

export const hasSupabase = Boolean(url && key);
