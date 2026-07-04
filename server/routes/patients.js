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

// GET /api/patients/:id — hasta detayı (sahip + aşı kayıtları + yaklaşan randevular)
router.get('/:id', async (req, res, next) => {
  try {
    const { data: pet, error } = await supabaseAdmin
      .from('pets')
      .select('id, name, species, breed, birth_date, gender, weight_kg, created_at, owners(id, name, phone, email)')
      .eq('id', req.params.id)
      .eq('clinic_id', req.clinicUser.clinic_id)
      .maybeSingle();
    if (error) throw error;
    if (!pet) return res.status(404).json({ error: 'Hasta bulunamadı.' });

    const { data: vaccinations, error: vErr } = await supabaseAdmin
      .from('pet_vaccinations')
      .select('id, vaccine_name, scheduled_date, completed_date, status, notes')
      .eq('pet_id', pet.id)
      .order('scheduled_date', { ascending: true })
      .limit(100);
    if (vErr) throw vErr;

    res.json({ pet, vaccinations });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/patients/:id — hasta ve sahip bilgilerini güncelle
// Body: { petName?, species?, breed?, birthDate?, gender?, weightKg?, ownerName?, ownerPhone?, ownerEmail? }
router.patch('/:id', async (req, res, next) => {
  try {
    const { petName, species, breed, birthDate, gender, weightKg, ownerName, ownerPhone, ownerEmail } = req.body || {};

    const { data: pet, error: findErr } = await supabaseAdmin
      .from('pets')
      .select('id, owner_id')
      .eq('id', req.params.id)
      .eq('clinic_id', req.clinicUser.clinic_id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!pet) return res.status(404).json({ error: 'Hasta bulunamadı.' });

    const errors = [];
    const petPatch = {};
    if (petName !== undefined) {
      if (!isNonEmptyString(petName, 100)) errors.push('Hayvan adı boş olamaz.');
      else petPatch.name = petName.trim();
    }
    if (species !== undefined) {
      if (!isNonEmptyString(species, 50)) errors.push('Tür boş olamaz.');
      else petPatch.species = species.trim().toLowerCase();
    }
    if (breed !== undefined) petPatch.breed = breed?.trim() || null;
    if (birthDate !== undefined) {
      if (birthDate && !isDateOnly(birthDate)) errors.push('Doğum tarihi geçersiz.');
      else petPatch.birth_date = birthDate || null;
    }
    if (gender !== undefined) {
      if (gender && !['erkek', 'dişi'].includes(gender)) errors.push('Cinsiyet "erkek" veya "dişi" olmalı.');
      else petPatch.gender = gender || null;
    }
    if (weightKg !== undefined) {
      const w = weightKg === '' || weightKg === null ? null : Number(weightKg);
      if (w !== null && (isNaN(w) || w <= 0 || w > 500)) errors.push('Kilo geçersiz.');
      else petPatch.weight_kg = w;
    }

    const ownerPatch = {};
    if (ownerName !== undefined) {
      if (!isNonEmptyString(ownerName)) errors.push('Sahip adı boş olamaz.');
      else ownerPatch.name = ownerName.trim();
    }
    if (ownerPhone !== undefined) {
      const p = normalizePhone(ownerPhone);
      if (!p) errors.push('Sahip telefonu geçersiz.');
      else ownerPatch.phone = p;
    }
    if (ownerEmail !== undefined) {
      if (ownerEmail && !isEmail(ownerEmail)) errors.push('Sahip e-postası geçersiz.');
      else ownerPatch.email = ownerEmail?.trim().toLowerCase() || null;
    }

    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    if (!Object.keys(petPatch).length && !Object.keys(ownerPatch).length) {
      return res.status(400).json({ error: 'Güncellenecek alan yok.' });
    }

    if (Object.keys(petPatch).length) {
      const { error } = await supabaseAdmin.from('pets').update(petPatch).eq('id', pet.id);
      if (error) throw error;
    }
    if (Object.keys(ownerPatch).length) {
      const { error } = await supabaseAdmin.from('owners').update(ownerPatch).eq('id', pet.owner_id);
      if (error) {
        if (String(error.message).includes('duplicate') || error.code === '23505') {
          return res.status(400).json({ error: 'Bu telefon numarası başka bir sahibe kayıtlı.' });
        }
        throw error;
      }
    }

    res.json({ message: 'Hasta bilgileri güncellendi.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
