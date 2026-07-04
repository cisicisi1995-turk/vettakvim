// Herkese açık uçlar (giriş gerektirmez) — nöbetçi veteriner bulucu
const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { todayIstanbul } = require('../validate');

const router = express.Router();

// GET /api/public/cities — kayıtlı klinik olan şehirler
router.get('/cities', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('clinics').select('city').limit(1000);
    if (error) throw error;
    const cities = [...new Set(data.map((c) => c.city.trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'tr'));
    res.json({ cities });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/on-duty?city=İstanbul — bugün nöbetçi klinikler
router.get('/on-duty', async (req, res, next) => {
  try {
    const city = (req.query.city || '').toString().trim();
    if (!city || city.length > 100) return res.status(400).json({ error: 'city parametresi zorunlu.' });

    const { data, error } = await supabaseAdmin
      .from('clinics')
      .select('id, name, city, district, address, phone, whatsapp_number, latitude, longitude')
      .ilike('city', city)
      .eq('is_on_duty', true)
      .eq('on_duty_date', todayIstanbul())
      .limit(100);
    if (error) throw error;

    res.json({ date: todayIstanbul(), city, clinics: data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
