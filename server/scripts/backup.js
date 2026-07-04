// Veritabanı yedeği: tüm tabloları JSON olarak backups/ klasörüne indirir.
// Kullanım: npm run backup
// Geri yükleme gerekirse: yedek dosyasındaki kayıtlar Supabase'e tablo tablo
// geri yazılabilir (bana "yedekten geri yükle" demeniz yeterli).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('../supabase');

const TABLES = ['clinics', 'clinic_users', 'owners', 'pets', 'vaccine_templates', 'pet_vaccinations', 'appointments', 'reminders_log'];

(async () => {
  const backup = { created_at: new Date().toISOString(), tables: {} };

  for (const table of TABLES) {
    const rows = [];
    let from = 0;
    const page = 1000;
    for (;;) {
      const { data, error } = await supabaseAdmin.from(table).select('*').range(from, from + page - 1);
      if (error) {
        console.error(`HATA (${table}):`, error.message);
        process.exit(1);
      }
      rows.push(...data);
      if (data.length < page) break;
      from += page;
    }
    backup.tables[table] = rows;
    console.log(`  ${table}: ${rows.length} kayıt`);
  }

  const dir = path.join(__dirname, '..', '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const file = path.join(dir, `yedek-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 1), 'utf8');
  console.log('\nYedek alındı: ' + file);
  process.exit(0);
})();
