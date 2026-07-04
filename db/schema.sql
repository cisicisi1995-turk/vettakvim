-- VetTakvim veritabanı şeması
-- Supabase SQL Editor'de çalıştırın (tamamını tek seferde yapıştırabilirsiniz).

-- Klinikler
CREATE TABLE IF NOT EXISTS clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    phone VARCHAR(20),
    whatsapp_number VARCHAR(20),
    working_hours JSONB, -- {"mon": "09:00-19:00", "tue": "09:00-19:00", ...}
    is_on_duty BOOLEAN DEFAULT FALSE, -- nöbetçi mi
    on_duty_date DATE, -- hangi tarihte nöbetçi
    subscription_tier VARCHAR(20) DEFAULT 'free', -- free, paid, featured
    subscription_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Klinik kullanıcıları (giriş yapan personel)
-- NOT: Şifreler Supabase Auth'ta tutulur; bu tablo auth.users'a bağlanır
-- ve kullanıcıyı bir kliniğe eşler. password_hash kolonuna gerek yok.
CREATE TABLE IF NOT EXISTS clinic_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'staff', -- owner, staff
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hayvan sahipleri
CREATE TABLE IF NOT EXISTS owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255), -- opsiyonel, telefon ile OTP girişi de olabilir
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hayvanlar
CREATE TABLE IF NOT EXISTS pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES owners(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id), -- kayıtlı olduğu klinik (varsa)
    name VARCHAR(100) NOT NULL,
    species VARCHAR(50) NOT NULL, -- kedi, köpek, kuş vs.
    breed VARCHAR(100),
    birth_date DATE,
    gender VARCHAR(10),
    weight_kg DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aşı/kontrol şablonları (standart takvim referansı) - FAZ 2
CREATE TABLE IF NOT EXISTS vaccine_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    species VARCHAR(50) NOT NULL,
    vaccine_name VARCHAR(100) NOT NULL,
    recommended_age_weeks INT,
    repeat_interval_days INT,
    description TEXT
);

-- Hayvanın aşı/kontrol kayıtları - FAZ 2
CREATE TABLE IF NOT EXISTS pet_vaccinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
    vaccine_template_id UUID REFERENCES vaccine_templates(id),
    vaccine_name VARCHAR(100) NOT NULL,
    scheduled_date DATE NOT NULL,
    completed_date DATE,
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, completed, overdue, cancelled
    clinic_id UUID REFERENCES clinics(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Randevular (klinik tarafı)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES pets(id),
    owner_id UUID REFERENCES owners(id),
    appointment_date TIMESTAMPTZ NOT NULL,
    reason VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, completed, cancelled, no_show
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gönderilen hatırlatmalar - FAZ 2
CREATE TABLE IF NOT EXISTS reminders_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_vaccination_id UUID REFERENCES pet_vaccinations(id),
    appointment_id UUID REFERENCES appointments(id),
    channel VARCHAR(20) NOT NULL, -- sms, whatsapp
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'sent' -- sent, failed, delivered
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_pets_owner ON pets(owner_id);
CREATE INDEX IF NOT EXISTS idx_pets_clinic ON pets(clinic_id);
CREATE INDEX IF NOT EXISTS idx_vaccinations_pet ON pet_vaccinations(pet_id);
CREATE INDEX IF NOT EXISTS idx_vaccinations_scheduled ON pet_vaccinations(scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date ON appointments(clinic_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_clinics_city_duty ON clinics(city, is_on_duty, on_duty_date);

-- RLS: Backend service_role anahtarı ile eriştiği için RLS'i açıp
-- hiçbir public policy tanımlamıyoruz. Böylece anon anahtarla doğrudan
-- tablolara erişilemez; tüm erişim Express API üzerinden geçer.
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaccine_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pet_vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders_log ENABLE ROW LEVEL SECURITY;
