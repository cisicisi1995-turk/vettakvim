// Basit istek loglama middleware'i.
// Render (ve benzeri platformlar) stdout'u otomatik toplar; loglar
// Render panelindeki "Logs" sekmesinden izlenir ve aranabilir.
function requestLogger(req, res, next) {
  const start = Date.now();
  // Yolu isteğin başında yakala: yanıt alt-router içinde biterse req.path kısalmış olur
  const fullPath = (req.originalUrl || req.url).split('?')[0];
  res.on('finish', () => {
    // Sağlık kontrolü ve statik dosyaları loglama (gürültü yapmasın)
    if (fullPath === '/api/health' || !fullPath.startsWith('/api')) return;
    const line = {
      t: new Date().toISOString(),
      ip: req.ip,
      method: req.method,
      path: fullPath,
      status: res.statusCode,
      ms: Date.now() - start,
      clinic: req.clinicUser?.clinic_id || null,
      user: req.clinicUser?.email || null,
    };
    console.log(JSON.stringify(line));
  });
  next();
}

module.exports = { requestLogger };
