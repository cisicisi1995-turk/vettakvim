const express = require('express');
const { supabaseAdmin } = require('../supabase');
const {
  isNonEmptyString,
  normalizePhone,
  isLocalDateTime,
  isDateOnly,
  istanbulToUtcIso,
  APPOINTMENT_STATUSES,
} = require('../validate');

const router = express.Router();

// Telefon numarasına göre sahibi bul/oluştur, sonra hayvanı bul/oluştur.
async function upsertOwnerAndPet({ ownerName, phone, petName, species, clinicId }) {
  let { data: owner } = await supabaseAdmin
    .from('owners')
    .select('id, name')
    .eq('phone', phone)
    .maybeSingle();

  if (!owner) {
    const { data, error } = await supabaseAdmin
      .from('owners')
      .insert({ name: ownerName, phone })
      .select('id, name')
      .single();
    if (error) throw error;
    owner = data;
  }

  let { data: pet } = await supabaseAdmin
    .from('pets')
    .select('id, name')
    .eq('owner_id', owner.id)
    .ilike('name', petName)
    .maybeSingle();

  if (!pet) {
    const { data, error } = await supabaseAdmin
      .from('pets')
      .insert({ owner_id: owner.id, clinic_id: clinicId, name: petName, species: species || 'bilinmiyor' })
      .select('id, name')
      .single();
    if (error) throw error;
    pet = data;
  }

  return { owner, pet };
}

// POST /api/appointments — yeni randevu
// Body: { ownerName, phone, petName, species?, dateTime ("YYYY-MM-DDTHH:mm", TR saati), reason? }
router.post('/', async (req, res, next) => {
  try {
    const { ownerName, phone, petName, species, dateTime, reason } = req.body || {};

    const errors = [];
    if (!isNonEmptyString(ownerName)) errors.push('Hayvan sahibi adı zorunlu.');
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) errors.push('Geçerli bir telefon girin (örn: 05XX XXX XX XX).');
    if (!isNonEmptyString(petName, 100)) errors.push('Hayvan adı zorunlu.');
    if (!isLocalDateTime(dateTime)) errors.push('Geçerli bir tarih-saat seçin.');
    if (reason && !isNonEmptyString(reason)) errors.push('Sebep 255 karakteri aşamaz.');
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const { owner, pet } = await upsertOwnerAndPet({
      ownerName: ownerName.trim(),
      phone: normalizedPhone,
      petName: petName.trim(),
      species: species?.trim(),
      clinicId: req.clinicUser.clinic_id,
    });

    const { data: appointment, error } = await supabaseAdmin
      .from('appointments')
      .insert({
        clinic_id: req.clinicUser.clinic_id,
        pet_id: pet.id,
        owner_id: owner.id,
        appointment_date: istanbulToUtcIso(dateTime),
        reason: reason?.trim() || null,
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;

    res.status(201).json({ appointment });
  } catch (err) {
    next(err);
  }
});

// GET /api/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD&status=pending
// Tarihler Türkiye günü olarak yorumlanır; "to" günü dahildir.
router.get('/', async (req, res, next) => {
  try {
    const { from, to, status } = req.query;

    let query = supabaseAdmin
      .from('appointments')
      .select('id, appointment_date, reason, status, created_at, pets(id, name, species), owners(id, name, phone)')
      .eq('clinic_id', req.clinicUser.clinic_id)
      .order('appointment_date', { ascending: true });

    if (from) {
      if (!isDateOnly(from)) return res.status(400).json({ error: 'from tarihi geçersiz.' });
      query = query.gte('appointment_date', istanbulToUtcIso(from + 'T00:00'));
    }
    if (to) {
      if (!isDateOnly(to)) return res.status(400).json({ error: 'to tarihi geçersiz.' });
      query = query.lte('appointment_date', istanbulToUtcIso(to + 'T23:59'));
    }
    if (status) {
      if (!APPOINTMENT_STATUSES.includes(status)) return res.status(400).json({ error: 'status geçersiz.' });
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ appointments: data });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/appointments/:id — durum güncelle
router.patch('/:id', async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!APPOINTMENT_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Geçersiz durum. Kullanılabilir: ' + APPOINTMENT_STATUSES.join(', ') });
    }

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update({ status })
      .eq('id', req.params.id)
      .eq('clinic_id', req.clinicUser.clinic_id) // başka kliniğin randevusuna dokunulamaz
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Randevu bulunamadı.' });

    res.json({ appointment: data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
