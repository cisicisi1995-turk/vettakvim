const express = require('express');
const { supabaseAdmin, supabaseAuth } = require('../supabase');
const { requireClinicUser } = require('../middleware/auth');
const { isNonEmptyString, isEmail, normalizePhone } = require('../validate');

const router = express.Router();

// POST /api/auth/register  — yeni klinik + ilk kullanıcı (owner) kaydı
router.post('/register', async (req, res, next) => {
  try {
    const { clinicName, city, district, phone, email, password } = req.body || {};

    const errors = [];
    if (!isNonEmptyString(clinicName)) errors.push('Klinik adı zorunlu.');
    if (!isNonEmptyString(city, 100)) errors.push('Şehir zorunlu.');
    if (!isEmail(email)) errors.push('Geçerli bir e-posta girin.');
    if (typeof password !== 'string' || password.length < 8) errors.push('Şifre en az 8 karakter olmalı.');
    const normalizedPhone = phone ? normalizePhone(phone) : null;
    if (phone && !normalizedPhone) errors.push('Telefon numarası geçersiz (örn: 0216 XXX XX XX veya 05XX XXX XX XX).');
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    // 1) Supabase Auth kullanıcısı oluştur
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // MVP: e-posta doğrulaması atlanıyor
    });
    if (authError) {
      const msg = /already/i.test(authError.message)
        ? 'Bu e-posta ile zaten bir hesap var.'
        : 'Hesap oluşturulamadı: ' + authError.message;
      return res.status(400).json({ error: msg });
    }

    // 2) Klinik kaydı
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .insert({
        name: clinicName.trim(),
        city: city.trim(),
        district: district?.trim() || null,
        phone: normalizedPhone,
      })
      .select()
      .single();
    if (clinicError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id); // geri al
      throw clinicError;
    }

    // 3) Kullanıcıyı kliniğe bağla
    const { error: linkError } = await supabaseAdmin.from('clinic_users').insert({
      id: authUser.user.id,
      clinic_id: clinic.id,
      email: email.trim().toLowerCase(),
      role: 'owner',
    });
    if (linkError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin.from('clinics').delete().eq('id', clinic.id);
      throw linkError;
    }

    res.status(201).json({ message: 'Klinik kaydı oluşturuldu. Giriş yapabilirsiniz.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!isEmail(email) || typeof password !== 'string') {
      return res.status(400).json({ error: 'E-posta ve şifre zorunlu.' });
    }

    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });

    const { data: clinicUser } = await supabaseAdmin
      .from('clinic_users')
      .select('clinic_id, role, clinics(name, city)')
      .eq('id', data.user.id)
      .single();

    if (!clinicUser) return res.status(403).json({ error: 'Bu hesap bir kliniğe bağlı değil.' });

    res.json({
      accessToken: data.session.access_token,
      clinic: { id: clinicUser.clinic_id, name: clinicUser.clinics.name, city: clinicUser.clinics.city },
      role: clinicUser.role,
      email: data.user.email,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — oturum kontrolü (sayfa yenilenince kullanılır)
router.get('/me', requireClinicUser, (req, res) => {
  res.json({
    clinic: { id: req.clinicUser.clinic_id, name: req.clinicUser.clinics.name, city: req.clinicUser.clinics.city },
    role: req.clinicUser.role,
    email: req.clinicUser.email,
  });
});

module.exports = router;
