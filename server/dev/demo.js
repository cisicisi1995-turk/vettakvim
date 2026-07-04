// DEMO MODU baslaticisi: once sahte Supabase'i ayaga kaldirir,
// sonra asil uygulamayi ona baglar. Gercek Supabase GEREKMEZ.
// Kullanim: npm run demo
console.log('');
console.log('=== DEMO MODU ===');
console.log('Supabase olmadan calisiyor. Girilen veriler BELLEKTE tutulur;');
console.log('sunucuyu kapatinca (Ctrl+C) silinir. Gercek kurulum icin README.md.');
console.log('');

require('./mock-supabase').then((port) => {
  process.env.SUPABASE_URL = 'http://localhost:' + port;
  process.env.SUPABASE_ANON_KEY = 'demo-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'demo-service-key';
  process.env.PORT = process.env.PORT || '3000';
  require('../index');
});
