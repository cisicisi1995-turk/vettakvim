const express = require('express');
const { supabaseAdmin } = require('../supabase');
const { todayIstanbul, addDays, istanbulToUtcIso } = require('../validate');

const router = express.Router();

const DATE_FMT = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', weekday: 'long' });
const DATETIME_FMT = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', weekday: 'long', hour: '2-digit', minute: '2-digit' });

function waLink(phone, message) {
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message);
}

// GET /api/reminders — gönderilmeye hazır hatırlatma listesi
// Yaklaşan aşılar (bugün + 7 gün, gecikmişler dahil) ve yaklaşan randevular (48 saat)
router.get('/', async (req, res, next) => {
  try {
    const clinicId = req.clinicUser.clinic_id;
    const clinicName = req.clinicUser.clinics.name;
    const today = todayIstanbul();

    // --- Aşılar: gecikmiş + önümüzdeki 7 gün ---
    const { data: vaccinations, error: vErr } = await supabaseAdmin
      .from('pet_vaccinations')
      .select('id, vaccine_name, scheduled_date, status, pets(id, name, owner_id)')
      .eq('clinic_id', clinicId)
      .in('status', ['scheduled', 'overdue'])
      .lte('scheduled_date', addDays(today, 7))
      .order('scheduled_date', { ascending: true })
      .limit(100);
    if (vErr) throw vErr;

    // --- Randevular: önümüzdeki 48 saat ---
    const { data: appointments, error: aErr } = await supabaseAdmin
      .from('appointments')
      .select('id, appointment_date, reason, status, pets(id, name), owners(id, name, phone)')
      .eq('clinic_id', clinicId)
      .in('status', ['pending', 'confirmed'])
      .gte('appointment_date', istanbulToUtcIso(today + 'T00:00'))
      .lte('appointment_date', istanbulToUtcIso(addDays(today, 2) + 'T23:59'))
      .order('appointment_date', { ascending: true })
      .limit(100);
    if (aErr) throw aErr;

    // --- Sahip bilgileri (aşılar için) ---
    const ownerIds = [...new Set(vaccinations.map((v) => v.pets?.owner_id).filter(Boolean))];
    let ownersById = {};
    if (ownerIds.length) {
      const { data: owners, error: oErr } = await supabaseAdmin.from('owners').select('id, name, phone').in('id', ownerIds);
      if (oErr) throw oErr;
      ownersById = Object.fromEntries(owners.map((o) => [o.id, o]));
    }

    // --- Son 7 günde gönderilenler (tekrar göndermeyi önlemek için işaretle) ---
    const { data: logs, error: lErr } = await supabaseAdmin
      .from('reminders_log')
      .select('pet_vaccination_id, appointment_id, sent_at')
      .gte('sent_at', new Date(Date.now() - 7 * 86400000).toISOString());
    if (lErr) throw lErr;
    const sentVacc = new Set(logs.map((l) => l.pet_vaccination_id).filter(Boolean));
    const sentAppt = new Set(logs.map((l) => l.appointment_id).filter(Boolean));

    const reminders = [];

    for (const v of vaccinations) {
      const owner = v.pets ? ownersById[v.pets.owner_id] : null;
      if (!owner) continue;
      const overdue = v.scheduled_date < today;
      const message =
        `Merhaba ${owner.name}, ${v.pets.name} için ${v.vaccine_name} uygulamasının ` +
        (overdue ? `planlanan tarihi (${DATE_FMT.format(new Date(v.scheduled_date + 'T12:00:00Z'))}) geçti. ` :
                   `zamanı yaklaşıyor (${DATE_FMT.format(new Date(v.scheduled_date + 'T12:00:00Z'))}). `) +
        `Randevu için bize ulaşabilirsiniz. 🐾 ${clinicName}`;
      reminders.push({
        type: 'vaccination',
        id: v.id,
        petName: v.pets.name,
        ownerName: owner.name,
        phone: owner.phone,
        date: v.scheduled_date,
        label: v.vaccine_name,
        overdue,
        message,
        waLink: waLink(owner.phone, message),
        alreadySent: sentVacc.has(v.id),
      });
    }

    for (const a of appointments) {
      if (!a.owners) continue;
      const message =
        `Merhaba ${a.owners.name}, ${a.pets?.name || 'dostunuz'} için ${DATETIME_FMT.format(new Date(a.appointment_date))} ` +
        `tarihindeki randevunuzu hatırlatırız${a.reason ? ' (' + a.reason + ')' : ''}. Görüşmek üzere! 🐾 ${clinicName}`;
      reminders.push({
        type: 'appointment',
        id: a.id,
        petName: a.pets?.name || '',
        ownerName: a.owners.name,
        phone: a.owners.phone,
        date: a.appointment_date,
        label: a.reason || 'randevu',
        overdue: false,
        message,
        waLink: waLink(a.owners.phone, message),
        alreadySent: sentAppt.has(a.id),
      });
    }

    res.json({ reminders });
  } catch (err) {
    next(err);
  }
});

// POST /api/reminders/log — "WhatsApp'tan gönderdim" kaydı
// Body: { type: 'vaccination'|'appointment', id }
router.post('/log', async (req, res, next) => {
  try {
    const { type, id } = req.body || {};
    if (!['vaccination', 'appointment'].includes(type) || !id) {
      return res.status(400).json({ error: 'type (vaccination|appointment) ve id zorunlu.' });
    }

    const row = { channel: 'whatsapp', status: 'sent' };
    if (type === 'vaccination') row.pet_vaccination_id = id;
    else row.appointment_id = id;

    const { data, error } = await supabaseAdmin.from('reminders_log').insert(row).select().single();
    if (error) throw error;
    res.status(201).json({ log: data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
