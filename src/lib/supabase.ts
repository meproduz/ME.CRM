import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente singleton para uso no browser (componentes client-side)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
