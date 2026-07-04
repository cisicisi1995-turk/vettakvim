// Günlük bakım görevi: tarihi geçmiş "scheduled" aşıları "overdue" yapar.
// Sunucu açılışında bir kez ve her gün 08:00'de (Türkiye saati) çalışır.
const cron = require('node-cron');
const { supabaseAdmin } = require('./supabase');
const { todayIstanbul } = require('./validate');

async function markOverdueVaccinations() {
  const { data, error } = await supabaseAdmin
    .from('pet_vaccinations')
    .update({ status: 'overdue' })
    .eq('status', 'scheduled')
    .lt('scheduled_date', todayIstanbul())
    .select('id');
  if (error) {
    console.error('[cron] Gecikmiş aşı güncellemesi başarısız:', error.message);
    return;
  }
  if (data.length) console.log(`[cron] ${data.length} aşı kaydı "overdue" olarak işaretlendi.`);
}

function startCron() {
  markOverdueVaccinations(); // açılışta hemen çalıştır
  cron.schedule('0 8 * * *', markOverdueVaccinations, { timezone: 'Europe/Istanbul' });
  console.log('[cron] Günlük aşı kontrolü zamanlandı (her gün 08:00, Europe/Istanbul).');
}

module.exports = { startCron, markOverdueVaccinations };
