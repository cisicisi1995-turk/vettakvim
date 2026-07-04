# 🐾 VetTakvim — MVP (FAZ 1)

Veteriner klinikleri için randevu ve aşı hatırlatma sistemi.

## Kurulum

### 1. Supabase projesi hazırlığı
1. [supabase.com](https://supabase.com) üzerinde yeni bir proje oluşturun.
2. **SQL Editor**'e gidin, `db/schema.sql` dosyasının tamamını yapıştırıp çalıştırın.
3. **Project Settings > API** sayfasından şunları alın:
   - Project URL
   - `anon` (public) anahtarı
   - `service_role` anahtarı (gizli — sadece backend kullanır)

### 2. Ortam değişkenleri
```
copy .env.example .env
```
`.env` dosyasını açıp Supabase bilgilerinizi girin.

### 3. Çalıştırma
```
npm install
npm run dev
```
Tarayıcıda: http://localhost:3000

## FAZ 1 Kapsamı (mevcut)
- ✅ Klinik kaydı + giriş (Supabase Auth, email/şifre)
- ✅ Yeni randevu ekleme (sahip adı, telefon, hayvan, tarih-saat, sebep)
  — sahip ve hayvan yoksa otomatik oluşturulur (telefon numarasına göre eşleşir)
- ✅ Randevu listesi: Bugün / Bu Hafta / Tümü + durum filtresi
- ✅ Randevu durum güncelleme (bekliyor → onaylandı → tamamlandı / gelmedi / iptal)
- ✅ Hasta (hayvan + sahip) kayıt formu ve arama
- ✅ Türkiye saat dilimi (Europe/Istanbul), mobil uyumlu arayüz

## Güvenlik notları
- Tüm DB erişimi backend üzerinden `service_role` ile yapılır; tablolarda RLS
  açık ve public policy yok, yani `anon` anahtarla doğrudan tablo erişimi kapalı.
- SQL injection: supabase-js parametreli sorgular kullanır.
- XSS: frontend'de tüm dinamik içerik `textContent` ile yazılır, `innerHTML` yok.
- `.env` dosyasını asla commit etmeyin (`.gitignore`'da).

## FAZ 2 Kapsamı (mevcut)
- ✅ Standart aşı şablonları: kedi/köpek için 12 şablon (`npm run seed` ile yüklenir)
- ✅ Doğum tarihine göre otomatik aşı planı (Hastalar sekmesi > "Aşı Planı Oluştur")
  — geçmişte kalan tekrarlı aşılar bir sonraki uygun tarihe sarılır
- ✅ Aşı takvimi görünümü: durum/tarih filtresi, "Yapıldı" işaretlenince
  tekrarlı aşının sonraki dozu otomatik planlanır
- ✅ Günlük cron (her gün 08:00 TR): tarihi geçen aşıları "gecikti" yapar
- ✅ Hatırlatma sekmesi: yaklaşan/geciken aşılar + 48 saat içindeki randevular
  için hazır Türkçe WhatsApp mesajı; tek tıkla wa.me üzerinden gönderim,
  "Gönderildi" işaretlenince 7 gün tekrar gösterilmez (reminders_log)

## Komutlar
- `npm run dev` — geliştirme sunucusu (gerçek Supabase)
- `npm run demo` — Supabase'siz demo modu (veriler bellekte, kapanınca silinir)
- `npm run seed` — aşı şablonlarını Supabase'e yükler (tekrar çalıştırmak güvenli)

## FAZ 3 Kapsamı (mevcut)
- ✅ Herkese açık nöbetçi veteriner sayfası: `/nobetci.html` — şehir seç,
  bugün nöbetçi klinikleri listele; ara / WhatsApp / yol tarifi düğmeleri
- ✅ Harita (Leaflet + OpenStreetMap): koordinat girmiş klinikler haritada görünür
- ✅ Panelde "🏥 Klinik" sekmesi: adres, telefon, WhatsApp, koordinat ve
  **"Bugün nöbetçiyiz"** anahtarı (nöbet sadece o gün için geçerli olur)

## Sonraki adımlar (fikirler)
- Yayına alma (Render/Railway + alan adı), hayvan sahibi girişi (OTP),
  otomatik SMS/WhatsApp API, abonelik/ödeme
