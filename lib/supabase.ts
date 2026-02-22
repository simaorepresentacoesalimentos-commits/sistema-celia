
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dffypcdpzcrisbcreyqw.supabase.co';
// Chave JWT correta do Supabase fornecida pelo usuário
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmZnlwY2RwemNyaXNiY3JleXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1OTIxNzgsImV4cCI6MjA4NjE2ODE3OH0.b0ZXZrLF1Tc_g99AI7bHkTWRuym9VogBmEd_5ocQ1-M';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
