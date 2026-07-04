// Basit form validasyon yardımcıları.
// Not: SQL injection'a karşı ayrıca bir şey yapmaya gerek yok;
// supabase-js tüm sorguları parametreli gönderir.

function isNonEmptyString(v, max = 255) {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
}

function isEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 255;
}

// Türkiye telefon formatlarını kabul edip 90XXXXXXXXXX'e normalize eder.
// Cep (5XX) ve sabit hat (2XX/3XX/4XX) numaraları kabul edilir.
// Kabul edilen girişler: 0XXX..., XXX... (10 hane), +90XXX..., 90XXX...
function normalizePhone(v) {
  if (typeof v !== 'string') return null;
  const digits = v.replace(/[\s()\-+.]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  if (/^0[2-5]\d{9}$/.test(digits)) return '90' + digits.slice(1);
  if (/^[2-5]\d{9}$/.test(digits)) return '90' + digits;
  if (/^90[2-5]\d{9}$/.test(digits)) return digits;
  return null;
}

// ISO benzeri "YYYY-MM-DDTHH:mm" yerel (Türkiye) tarih-saatini doğrular.
function isLocalDateTime(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) && !isNaN(Date.parse(v));
}

function isDateOnly(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
}

// Türkiye'de saat dilimi sabittir (UTC+3, yaz saati uygulanmıyor).
// "YYYY-MM-DDTHH:mm" (İstanbul yerel saati) -> UTC ISO string
function istanbulToUtcIso(localDateTime) {
  return new Date(localDateTime + ':00+03:00').toISOString();
}

// Türkiye saatine göre bugünün YYYY-MM-DD değeri
function todayIstanbul() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
}

// "YYYY-MM-DD" + gün -> "YYYY-MM-DD"
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
const VACCINATION_STATUSES = ['scheduled', 'completed', 'overdue', 'cancelled'];

module.exports = {
  isNonEmptyString,
  isEmail,
  normalizePhone,
  isLocalDateTime,
  isDateOnly,
  istanbulToUtcIso,
  todayIstanbul,
  addDays,
  APPOINTMENT_STATUSES,
  VACCINATION_STATUSES,
};
