// Aşı şablonlarını Supabase'e yükler. Kullanım: npm run seed
// Daha önce yüklenmişse tekrar eklemez (aşı adı + tür bazında kontrol eder).
require('dotenv').config();
const { supabaseAdmin } = require('../supabase');
const templates = require('../data/vaccine-templates');

(async () => {
  const { data: existing, error: readError } = await supabaseAdmin
    .from('vaccine_templates')
    .select('species, vaccine_name');
  if (readError) {
    console.error('HATA: vaccine_templates tablosu okunamadı:', readError.message);
    console.error('db/schema.sql dosyasını Supabase SQL Editor\'de çalıştırdığınızdan emin olun.');
    process.exit(1);
  }

  const have = new Set(existing.map((t) => t.species + '|' + t.vaccine_name));
  const toInsert = templates.filter((t) => !have.has(t.species + '|' + t.vaccine_name));

  if (!toInsert.length) {
    console.log('Tüm aşı şablonları zaten yüklü (' + existing.length + ' kayıt). Değişiklik yapılmadı.');
    process.exit(0);
  }

  const { error } = await supabaseAdmin.from('vaccine_templates').insert(toInsert);
  if (error) {
    console.error('HATA: şablonlar eklenemedi:', error.message);
    process.exit(1);
  }
  console.log(toInsert.length + ' aşı şablonu yüklendi (' + existing.length + ' zaten vardı).');
  process.exit(0);
})();
