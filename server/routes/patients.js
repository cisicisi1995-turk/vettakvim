const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { isNonEmptyString, isEmail, normalizePhone, isDateOnly } = require('../validate');

const router = express.Router();

// POST /api/patients — hayvan + sahip kaydı (klinik personeli girer)
// Body: { ownerName, phone, email?, petName, species, breed?, birthDate?, gender?, weightKg? }
router.post('/', async (req, res, next) => {
  try {
    const { ownerName, phone, email, petName, species, breed, birthDate, gender, weightKg } = req.body || {};

    const errors = [];
    if (!isNonEmptyString(ownerName)) errors.push('Sahip adı zorunlu.');
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) errors.push('Geçerli bir telefon girin.');
    if (email && !isEmail(email)) errors.push('E-posta geçersiz.');
    if (!isNonEmptyString(petName, 100)) errors.push('Hayvan adı zorunlu.');
    if (!isNonEmptyString(species, 50)) errors.push('Tür zorunlu (kedi, köpek vs.).');
    if (birthDate && !isDateOnly(birthDate)) errors.push('Doğum tarihi geçersiz.');
    if (gender && !['erkek', 'dişi'].includes(gender)) errors.push('Cinsiyet "erkek" veya "dişi" olmalı.');
    const weight = weightKg === undefined || weightKg === null || weightKg === '' ? null : Number(weightKg);
    if (weight !== null && (isNaN(weight) || weight <= 0 || weight > 500)) errors.push('Kilo geçersiz.');
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    // Sahip: telefona göre bul veya oluştur
    let { data: owner } = await supabaseAdmin
      .from('owners')
      .select('id, name, phone')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (!owner) {
      const { data, error } = await supabaseAdmin
        .from('owners')
        .insert({ name: ownerName.trim(), phone: normalizedPhone, email: email?.trim().toLowerCase() || null })
        .select('id, name, phone')
        .single();
      if (error) throw error;
      owner = data;
    }

    const { data: pet, error: petError } = await supabaseAdmin
      .from('pets')
      .insert({
        owner_id: owner.id,
        clinic_id: req.clinicUser.clinic_id,
        name: petName.trim(),
        species: species.trim().toLowerCase(),
        breed: breed?.trim() || null,
        birth_date: birthDate || null,
        gender: gender || null,
        weight_kg: weight,
      })
      .select()
      .single();
    if (petError) throw petError;

    res.status(201).json({ owner, pet });
  } catch (err) {
    next(err);
  }
});

// GET /api/patients?search=... — kliniğin hasta listesi
router.get('/', async (req, res, next) => {
  try {
    const search = (req.query.search || '').toString().trim();

    let query = supabaseAdmin
      .from('pets')
      .select('id, name, species, breed, birth_date, gender, weight_kg, created_at, owners(id, name, phone)')
      .eq('clinic_id', req.clinicUser.clinic_id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ pets: data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
