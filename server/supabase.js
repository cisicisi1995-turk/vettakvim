require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;

const missing = !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY;
const placeholder = [SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY].some((v) => v && v.includes('BURAYA'));
if (missing || placeholder) {
  console.error('');
  console.error('HATA: Supabase bilgileri eksik. Sunucu baslatilamiyor.');
  console.error('');
  console.error('Yapmaniz gereken:');
  console.error('1. https://supabase.com/dashboard adresinde projenizi acin');
  console.error('2. Project Settings (disli ikon) > API sayfasina gidin');
  console.error('3. Proje klasorundeki .env dosyasini Not Defteri ile acin');
  console.error('4. URL, anon key ve service_role key degerlerini yapistirip kaydedin');
  console.error('5. "npm run dev" komutunu tekrar calistirin');
  console.error('');
  process.exit(1);
}

// Veritabanı işlemleri için (RLS'i bypass eder, sadece backend'de kullanılır)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Kullanıcı token doğrulama ve giriş işlemleri için
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

module.exports = { supabaseAdmin, supabaseAuth };
