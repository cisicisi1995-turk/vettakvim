const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { isNonEmptyString, isDateOnly, todayIstanbul, addDays, VACCINATION_STATUSES } = require('../validate');

const router = express.Router();

// POST /api/vaccinations — tek aşı kaydı (şablon dışı / elle giriş)
// Body: { petId, vaccineName, scheduledDate }
router.post('/', async (req, res, next) => {
  try {
    const { petId, vaccineName, scheduledDate } = req.body || {};
    const errors = [];
    if (!petId) errors.push('petId zorunlu.');
    if (!isNonEmptyString(vaccineName, 100)) errors.push('Aşı adı zorunlu.');
    if (!isDateOnly(scheduledDate)) errors.push('Geçerli bir tarih seçin.');
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const { data: pet, error: petErr } = await supabaseAdmin
      .from('pets')
      .select('id')
      .eq('id', petId)
      .eq('clinic_id', req.clinicUser.clinic_id)
      .maybeSingle();
    if (petErr) throw petErr;
    if (!pet) return res.status(404).json({ error: 'Hasta bulunamadı.' });

    const { data, error } = await supabaseAdmin
      .from('pet_vaccinations')
      .insert({
        pet_id: pet.id,
        vaccine_name: vaccineName.trim(),
        scheduled_date: scheduledDate,
        status: 'scheduled',
        clinic_id: req.clinicUser.clinic_id,
      })
      .select()
      .single();
    if (error) throw error;

    res.status(201).json({ vaccination: data });
  } catch (err) {
    next(err);
  }
});

// POST /api/vaccinations/plan/:petId — doğum tarihine göre otomatik aşı planı oluştur
router.post('/plan/:petId', async (req, res, next) => {
  try {
    const { data: pet, error: petError } = await supabaseAdmin
      .from('pets')
      .select('id, name, species, birth_date, clinic_id')
      .eq('id', req.params.petId)
      .eq('clinic_id', req.clinicUser.clinic_id)
      .maybeSingle();
    if (petError) throw petError;
    if (!pet) return res.status(404).json({ error: 'Hasta bulunamadı.' });
    if (!pet.birth_date) {
      return res.status(400).json({ error: 'Aşı planı için önce hayvanın doğum tarihi girilmeli.' });
    }

    const { data: templates, error: tplError } = await supabaseAdmin
      .from('vaccine_templates')
      .select('*')
      .eq('species', pet.species);
    if (tplError) throw tplError;
    if (!templates.length) {
      return res.status(400).json({ error: `"${pet.species}" türü için aşı şablonu yok. (Şablonları yüklemek için: npm run seed)` });
    }

    // Mevcut kayıtlarla çakışmayı önle: aynı aşı adı zaten planlı/yapılmışsa atla
    const { data: existing, error: exError } = await supabaseAdmin
      .from('pet_vaccinations')
      .select('vaccine_name, status')
      .eq('pet_id', pet.id);
    if (exError) throw exError;
    const already = new Set(existing.filter((v) => v.status !== 'cancelled').map((v) => v.vaccine_name));

    const today = todayIstanbul();
    const rows = [];
    const skipped = [];

    for (const tpl of templates) {
      if (already.has(tpl.vaccine_name)) { skipped.push(tpl.vaccine_name); continue; }

      let date = addDays(pet.birth_date, (tpl.recommended_age_weeks || 0) * 7);
      if (date < today) {
        if (!tpl.repeat_interval_days) { skipped.push(tpl.vaccine_name); continue; } // tek seferlik ve tarihi geçmiş
        while (date < today) date = addDays(date, tpl.repeat_interval_days); // sıradaki tekrara sar
      }

      rows.push({
        pet_id: pet.id,
        vaccine_template_id: tpl.id,
        vaccine_name: tpl.vaccine_name,
        scheduled_date: date,
        status: 'scheduled',
        clinic_id: req.clinicUser.clinic_id,
      });
    }

    if (!rows.length) {
      return res.json({ created: [], skipped, message: 'Eklenecek yeni aşı yok (hepsi zaten planlı veya tarihi geçmiş tek seferlik dozlar).' });
    }

    const { data: created, error } = await supabaseAdmin.from('pet_vaccinations').insert(rows).select();
    if (error) throw error;

    res.status(201).json({ created, skipped, message: created.length + ' aşı planlandı.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/vaccinations?status=scheduled&days=30&petId=...
// Kliniğin aşı kayıtları; days verilirse bugünden o kadar gün ilerisine kadar.
router.get('/', async (req, res, next) => {
  try {
    const { status, days, petId } = req.query;

    let query = supabaseAdmin
      .from('pet_vaccinations')
      .select('id, vaccine_name, scheduled_date, completed_date, status, notes, pet_id, pets(id, name, species, owner_id)')
      .eq('clinic_id', req.clinicUser.clinic_id)
      .order('scheduled_date', { ascending: true })
      .limit(200);

    if (status) {
      if (!VACCINATION_STATUSES.includes(status)) return res.status(400).json({ error: 'status geçersiz.' });
      query = query.eq('status', status);
    }
    if (days) {
      const n = Number(days);
      if (isNaN(n) || n < 0 || n > 365) return res.status(400).json({ error: 'days 0-365 arası olmalı.' });
      query = query.lte('scheduled_date', addDays(todayIstanbul(), n));
    }
    if (petId) query = query.eq('pet_id', petId);

    const { data: vaccinations, error } = await query;
    if (error) throw error;

    // Sahip bilgilerini ekle (telefon, ad) — WhatsApp için gerekli
    const ownerIds = [...new Set(vaccinations.map((v) => v.pets?.owner_id).filter(Boolean))];
    let ownersById = {};
    if (ownerIds.length) {
      const { data: owners, error: oErr } = await supabaseAdmin
        .from('owners')
        .select('id, name, phone')
        .in('id', ownerIds);
      if (oErr) throw oErr;
      ownersById = Object.fromEntries(owners.map((o) => [o.id, o]));
    }
    for (const v of vaccinations) {
      v.owner = v.pets ? ownersById[v.pets.owner_id] || null : null;
    }

    res.json({ vaccinations });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/vaccinations/:id — durum güncelle (yapıldı / iptal / yeniden planla)
// Body: { status, completedDate?, scheduledDate? }
router.patch('/:id', async (req, res, next) => {
  try {
    const { status, completedDate, scheduledDate } = req.body || {};
    if (!VACCINATION_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Geçersiz durum. Kullanılabilir: ' + VACCINATION_STATUSES.join(', ') });
    }

    const patch = { status };
    if (status === 'completed') {
      if (completedDate && !isDateOnly(completedDate)) return res.status(400).json({ error: 'completedDate geçersiz.' });
      patch.completed_date = completedDate || todayIstanbul();
    }
    if (scheduledDate) {
      if (!isDateOnly(scheduledDate)) return res.status(400).json({ error: 'scheduledDate geçersiz.' });
      patch.scheduled_date = scheduledDate;
    }

    const { data, error } = await supabaseAdmin
      .from('pet_vaccinations')
      .update(patch)
      .eq('id', req.params.id)
      .eq('clinic_id', req.clinicUser.clinic_id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Aşı kaydı bulunamadı.' });

    // Yapılan tekrarlı aşının bir sonraki dozunu otomatik planla
    let nextDose = null;
    if (status === 'completed' && data.vaccine_template_id) {
      const { data: tpl } = await supabaseAdmin
        .from('vaccine_templates')
        .select('repeat_interval_days')
        .eq('id', data.vaccine_template_id)
        .maybeSingle();
      if (tpl?.repeat_interval_days) {
        const { data: created } = await supabaseAdmin
          .from('pet_vaccinations')
          .insert({
            pet_id: data.pet_id,
            vaccine_template_id: data.vaccine_template_id,
            vaccine_name: data.vaccine_name,
            scheduled_date: addDays(patch.completed_date, tpl.repeat_interval_days),
            status: 'scheduled',
            clinic_id: req.clinicUser.clinic_id,
          })
          .select()
          .single();
        nextDose = created;
      }
    }

    res.json({ vaccination: data, nextDose });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
