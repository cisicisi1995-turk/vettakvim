require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { requestLogger } = require('./logger');

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

// Render/proxy arkasında gerçek ziyaretçi IP'sini görebilmek için (rate limit doğru çalışsın)
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(requestLogger);

// Genel API limiti: IP başına 15 dakikada 300 istek
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek gönderildi. Lütfen birkaç dakika sonra tekrar deneyin.' },
}));

// Giriş/kayıt için sıkı limit: IP başına 15 dakikada 20 deneme (brute force koruması)
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla giriş denemesi yapıldı. 15 dakika sonra tekrar deneyin.' },
}));
app.use('/api/auth/register', rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyin.' },
}));

const startTime = Date.now();
app.get('/api/health', (req, res) => res.json({
  ok: true,
  uptimeSec: Math.floor((Date.now() - startTime) / 1000),
  memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  version: require('../package.json').version,
}));

app.use('/api/auth', authRoutes);
app.use('/api/appointments', requireClinicUser, appointmentRoutes);
app.use('/api/patients', requireClinicUser, patientRoutes);
app.use('/api/vaccinations', requireClinicUser, vaccinationRoutes);
app.use('/api/reminders', requireClinicUser, reminderRoutes);
app.use('/api/clinic', requireClinicUser, clinicRoutes);
app.use('/api/public', publicRoutes);

// Genel hata yakalayıcı
app.use((err, req, res, next) => {
  console.error(JSON.stringify({
    t: new Date().toISOString(),
    level: 'ERROR',
    method: req.method,
    path: req.path,
    clinic: req.clinicUser?.clinic_id || null,
    message: err.message,
  }));
  console.error(err.stack);
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
