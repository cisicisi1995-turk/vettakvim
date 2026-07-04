const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { isNonEmptyString, normalizePhone, todayIstanbul } = require('../validate');

const router = express.Router();

// GET /api/clinic — kendi klinik bilgileri
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('clinics')
      .select('id, name, city, district, address, phone, whatsapp_number, latitude, longitude, is_on_duty, on_duty_date')
      .eq('id', req.clinicUser.clinic_id)
      .single();
    if (error) throw error;

    // Nöbet tarihi geçmişse arayüzde kapalı göster
    if (data.is_on_duty && data.on_duty_date !== todayIstanbul()) data.is_on_duty = false;
    res.json({ clinic: data });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/clinic — klinik bilgilerini güncelle
// Body: { name?, city?, district?, address?, phone?, whatsappNumber?, latitude?, longitude?, isOnDuty? }
router.patch('/', async (req, res, next) => {
  try {
    const { name, city, district, address, phone, whatsappNumber, latitude, longitude, isOnDuty } = req.body || {};
    const patch = {};
    const errors = [];

    if (name !== undefined) {
      if (!isNonEmptyString(name)) errors.push('Klinik adı boş olamaz.');
      else patch.name = name.trim();
    }
    if (city !== undefined) {
      if (!isNonEmptyString(city, 100)) errors.push('Şehir boş olamaz.');
      else patch.city = city.trim();
    }
    if (district !== undefined) patch.district = district?.trim() || null;
    if (address !== undefined) patch.address = address?.trim() || null;

    if (phone !== undefined) {
      if (phone === '' || phone === null) patch.phone = null;
      else {
        const p = normalizePhone(phone);
        if (!p) errors.push('Telefon numarası geçersiz.');
        else patch.phone = p;
      }
    }
    if (whatsappNumber !== undefined) {
      if (whatsappNumber === '' || whatsappNumber === null) patch.whatsapp_number = null;
      else {
        const w = normalizePhone(whatsappNumber);
        if (!w) errors.push('WhatsApp numarası geçersiz.');
        else patch.whatsapp_number = w;
      }
    }

    for (const [key, val] of [['latitude', latitude], ['longitude', longitude]]) {
      if (val === undefined) continue;
      if (val === '' || val === null) { patch[key] = null; continue; }
      const n = Number(val);
      const limit = key === 'latitude' ? 90 : 180;
      if (isNaN(n) || Math.abs(n) > limit) errors.push(key + ' geçersiz.');
      else patch[key] = n;
    }

    if (isOnDuty !== undefined) {
      patch.is_on_duty = Boolean(isOnDuty);
      patch.on_duty_date = isOnDuty ? todayIstanbul() : null;
    }

    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Güncellenecek alan yok.' });

    const { data, error } = await supabaseAdmin
      .from('clinics')
      .update(patch)
      .eq('id', req.clinicUser.clinic_id)
      .select()
      .single();
    if (error) throw error;

    res.json({ clinic: data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
