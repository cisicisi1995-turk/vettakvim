# VetTakvim — Proje Rehberi

Veteriner klinikleri için randevu + aşı hatırlatma sistemi (MVP). Kullanıcı teknik
geçmişi olmayan bir girişimci; açıklamaları Türkçe, sade ve adım adım yap.
Arayüz dili tamamen Türkçe.

## Mimari
- **Backend:** Node.js + Express (`server/`), Supabase (PostgreSQL) — tüm DB erişimi
  `service_role` anahtarıyla backend üzerinden. Tablolarda RLS açık, public policy yok.
- **Auth:** Supabase Auth (email/şifre). `clinic_users.id` = `auth.users.id`.
  Middleware: `server/middleware/auth.js` — her istek kullanıcının kendi kliniğine kilitlenir.
- **Frontend:** vanilla JS tek sayfa (`public/index.html` + `app.js` = klinik paneli,
  `nobetci.html` + `nobetci.js` = herkese açık nöbetçi bulucu, Leaflet haritalı).
- **Şema:** `db/schema.sql` (idempotent, Supabase SQL Editor'de çalıştırılır).

## Komutlar
- `npm run dev` — gerçek Supabase ile geliştirme (.env gerekli)
- `npm run demo` — Supabase'siz demo: `server/dev/mock-supabase.js` bellekte sahte
  Supabase çalıştırır (port 54321, tek örnek çalışabilir). Veriler kalıcı değildir.
- `npm run seed` — aşı şablonlarını yükler (`server/data/vaccine-templates.js`, idempotent)

## Kurallar / kararlar
- **Saat dilimi:** her yerde Europe/Istanbul (sabit UTC+3). Sunucu tarafında
  `validate.js: todayIstanbul(), istanbulToUtcIso()`. Randevular TIMESTAMPTZ (UTC),
  aşılar DATE.
- **Telefonlar** `905XXXXXXXXX` biçiminde normalize edilip saklanır
  (`validate.js: normalizePhone` — cep VE sabit hat kabul eder). Görüntülerken
  `'0' + phone.slice(2)`.
- **XSS:** frontend'de kullanıcı verisi asla innerHTML'e yazılmaz, hep `textContent`.
- **Hatırlatmalar** otomatik gönderilmez: personel wa.me linkiyle elle gönderir,
  "Gönderildi" işaretlenince `reminders_log`a yazılır ve 7 gün tekrar gösterilmez.
- Aşı "yapıldı" işaretlenince tekrarlı şablonlarda sonraki doz otomatik planlanır.
- Cron (`server/cron.js`, node-cron): her gün 08:00 TR — geciken aşıları `overdue` yapar.
- Nöbet durumu `is_on_duty + on_duty_date` (sadece bugünse geçerli sayılır).

## Test
Kalıcı test altyapısı yok; e2e testler scratchpad'de yazılıp demo moduna karşı
koşturuldu (FAZ 1: 19, FAZ 2: 17, FAZ 3: 11 kontrol — hepsi geçti). Mock'un
sınırlamaları: PostgREST'in `eq/gt/gte/lt/lte/ilike/in/order/limit` operatörleri ve
tek seviye embed desteklenir; iç içe embed YOK (rotalarda iç içe embed kullanma,
ikinci sorguyla JS'te birleştir).

## Durum (Temmuz 2026)
- FAZ 1 (panel: randevu/hasta) ✅, FAZ 2 (aşı planı + WhatsApp hatırlatma) ✅,
  FAZ 3 (nöbetçi bulucu + klinik ayarları) ✅ — hepsi kullanıcının gerçek Supabase
  projesine bağlı çalışıyor (proje: qtvavywenmdskyuhhywm, Sydney bölgesi).
- Olası sonraki işler: yayına alma (Render/Railway + özel alan adı), hayvan sahibi
  tarafı (OTP girişi), otomatik SMS/WhatsApp API, abonelik/ödeme (subscription_tier).
