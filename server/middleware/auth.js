const { supabaseAdmin, supabaseAuth } = require('../supabase');

// Authorization: Bearer <access_token> başlığını doğrular,
// kullanıcının bağlı olduğu kliniği req.clinicUser olarak ekler.
async function requireClinicUser(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });
    }

    const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !userData?.user) {
      return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş. Tekrar giriş yapın.' });
    }

    const { data: clinicUser, error } = await supabaseAdmin
      .from('clinic_users')
      .select('id, clinic_id, email, role, clinics(id, name, city)')
      .eq('id', userData.user.id)
      .single();

    if (error || !clinicUser) {
      return res.status(403).json({ error: 'Bu hesap bir kliniğe bağlı değil.' });
    }

    req.clinicUser = clinicUser;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireClinicUser };
