require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const appointmentRoutes = require('./routes/appointments');
const patientRoutes = require('./routes/patients');
const vaccinationRoutes = require('./routes/vaccinations');
const reminderRoutes = require('./routes/reminders');
const clinicRoutes = require('./routes/clinic');
const publicRoutes = require('./routes/public');
const { requireClinicUser } = require('./middleware/auth');
const { startCron } = require('./cron');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/appointments', requireClinicUser, appointmentRoutes);
app.use('/api/patients', requireClinicUser, patientRoutes);
app.use('/api/vaccinations', requireClinicUser, vaccinationRoutes);
app.use('/api/reminders', requireClinicUser, reminderRoutes);
app.use('/api/clinic', requireClinicUser, clinicRoutes);
app.use('/api/public', publicRoutes);

// Genel hata yakalayıcı
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası. Lütfen tekrar deneyin.' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`VetTakvim çalışıyor: http://localhost:${PORT}`);
  startCron();
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`HATA: ${PORT} portu zaten kullanımda. Muhtemelen başka bir pencerede`);
    console.error('sunucu (npm run dev veya npm run demo) zaten çalışıyor.');
    console.error('Önce onu kapatın (Ctrl+C) ya da o pencereyi kullanmaya devam edin.');
    process.exit(1);
  }
  throw err;
});
