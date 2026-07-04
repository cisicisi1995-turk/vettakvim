// VetTakvim — Klinik Paneli (vanilla JS)
// XSS koruması: kullanıcı verisi hiçbir yerde innerHTML'e gömülmez;
// tüm dinamik içerik textContent ile yazılır.

const API = '/api';
const $ = (sel) => document.querySelector(sel);

let state = {
  token: localStorage.getItem('vt_token') || null,
  clinic: null,
  range: 'today', // today | week | all
  status: '',
};

// ---------- Yardımcılar ----------

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;

  const res = await fetch(API + path, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (res.status === 401) {
    logout();
    throw new Error(body.error || 'Oturum süresi doldu, tekrar giriş yapın.');
  }
  if (!res.ok) throw new Error(body.error || 'Bir hata oluştu.');
  return body;
}

function showMessage(el, text, type) {
  el.textContent = text;
  el.className = 'message ' + type + (el.classList.contains('toast') ? ' toast' : '');
  el.classList.remove('hidden');
  if (el.id === 'panel-message') setTimeout(() => el.classList.add('hidden'), 4000);
}

const TR_FMT = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: '2-digit', month: 'short', weekday: 'short',
  hour: '2-digit', minute: '2-digit',
});
function formatDate(iso) {
  return TR_FMT.format(new Date(iso));
}

// Türkiye saatine göre bugünün YYYY-MM-DD değeri
function todayTR(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  return now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
}

const STATUS_TR = {
  pending: 'Bekliyor',
  confirmed: 'Onaylandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  no_show: 'Gelmedi',
};

// ---------- Ekran geçişleri ----------

function showAuth() {
  $('#auth-screen').classList.remove('hidden');
  $('#panel-screen').classList.add('hidden');
}

function showPanel() {
  $('#auth-screen').classList.add('hidden');
  $('#panel-screen').classList.remove('hidden');
  $('#clinic-name').textContent = state.clinic ? `${state.clinic.name} · ${state.clinic.city}` : '';
  loadAppointments();
}

function logout() {
  state.token = null;
  state.clinic = null;
  localStorage.removeItem('vt_token');
  showAuth();
}

// ---------- Auth ----------

$('#tab-login').addEventListener('click', () => switchAuthTab('login'));
$('#tab-register').addEventListener('click', () => switchAuthTab('register'));

function switchAuthTab(which) {
  $('#tab-login').classList.toggle('active', which === 'login');
  $('#tab-register').classList.toggle('active', which === 'register');
  $('#login-form').classList.toggle('hidden', which !== 'login');
  $('#register-form').classList.toggle('hidden', which !== 'register');
  $('#auth-message').classList.add('hidden');
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
    });
    state.token = data.accessToken;
    state.clinic = data.clinic;
    localStorage.setItem('vt_token', data.accessToken);
    showPanel();
  } catch (err) {
    showMessage($('#auth-message'), err.message, 'error');
  }
});

$('#register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        clinicName: f.get('clinicName'),
        city: f.get('city'),
        district: f.get('district'),
        phone: f.get('phone'),
        email: f.get('email'),
        password: f.get('password'),
      }),
    });
    showMessage($('#auth-message'), 'Kayıt başarılı! Giriş yapabilirsiniz.', 'ok');
    switchAuthTab('login');
  } catch (err) {
    showMessage($('#auth-message'), err.message, 'error');
  }
});

$('#logout-btn').addEventListener('click', logout);

// ---------- Panel sekmeleri ----------

document.querySelectorAll('.panel-tabs .tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.panel-tabs .tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
    $('#view-' + btn.dataset.view).classList.remove('hidden');
    if (btn.dataset.view === 'appointments') loadAppointments();
    if (btn.dataset.view === 'patients') loadPatients();
    if (btn.dataset.view === 'vaccinations') loadVaccinations();
    if (btn.dataset.view === 'reminders') loadReminders();
    if (btn.dataset.view === 'clinic') loadClinic();
  });
});

// ---------- Randevular ----------

document.querySelectorAll('.filter-range').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-range').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.range = btn.dataset.range;
    loadAppointments();
  });
});

$('#filter-status').addEventListener('change', (e) => {
  state.status = e.target.value;
  loadAppointments();
});

async function loadAppointments() {
  const listEl = $('#appointments-list');
  listEl.textContent = 'Yükleniyor...';

  const params = new URLSearchParams();
  if (state.range === 'today') {
    params.set('from', todayTR());
    params.set('to', todayTR());
  } else if (state.range === 'week') {
    params.set('from', todayTR());
    params.set('to', todayTR(7));
  }
  if (state.status) params.set('status', state.status);

  try {
    const { appointments } = await api('/appointments?' + params);
    renderAppointments(appointments);
  } catch (err) {
    listEl.textContent = '';
    showMessage($('#panel-message'), err.message, 'error');
  }
}

function renderAppointments(items) {
  const listEl = $('#appointments-list');
  listEl.textContent = '';

  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Bu aralıkta randevu yok.';
    listEl.appendChild(p);
    return;
  }

  for (const a of items) {
    const item = document.createElement('div');
    item.className = 'list-item';

    const head = document.createElement('div');
    head.className = 'item-head';

    const title = document.createElement('strong');
    title.textContent = `${formatDate(a.appointment_date)} — ${a.pets?.name || '?'}`;

    const badge = document.createElement('span');
    badge.className = 'badge ' + a.status;
    badge.textContent = STATUS_TR[a.status] || a.status;

    head.append(title, badge);

    const info = document.createElement('div');
    info.className = 'muted';
    const ownerPhone = a.owners?.phone ? ' · 0' + a.owners.phone.slice(2) : '';
    info.textContent = `${a.owners?.name || ''}${ownerPhone}${a.reason ? ' · ' + a.reason : ''}`;

    const actions = document.createElement('div');
    actions.className = 'actions';
    const transitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'no_show', 'cancelled'],
    }[a.status] || [];

    for (const next of transitions) {
      const b = document.createElement('button');
      b.className = 'btn small';
      b.type = 'button';
      b.textContent = STATUS_TR[next];
      b.addEventListener('click', async () => {
        try {
          await api('/appointments/' + a.id, { method: 'PATCH', body: JSON.stringify({ status: next }) });
          loadAppointments();
        } catch (err) {
          showMessage($('#panel-message'), err.message, 'error');
        }
      });
      actions.appendChild(b);
    }

    item.append(head, info);
    if (transitions.length) item.appendChild(actions);
    listEl.appendChild(item);
  }
}

$('#appointment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await api('/appointments', {
      method: 'POST',
      body: JSON.stringify({
        ownerName: f.get('ownerName'),
        phone: f.get('phone'),
        petName: f.get('petName'),
        species: f.get('species'),
        dateTime: f.get('dateTime'),
        reason: f.get('reason'),
      }),
    });
    e.target.reset();
    showMessage($('#panel-message'), 'Randevu oluşturuldu ✓', 'ok');
  } catch (err) {
    showMessage($('#panel-message'), err.message, 'error');
  }
});

// ---------- Hastalar ----------

let searchTimer;
$('#patient-search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadPatients, 300);
});

async function loadPatients() {
  const listEl = $('#patients-list');
  const search = $('#patient-search').value.trim();
  const params = search ? '?search=' + encodeURIComponent(search) : '';

  try {
    const { pets } = await api('/patients' + params);
    listEl.textContent = '';

    if (!pets.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'Kayıtlı hasta bulunamadı.';
      listEl.appendChild(p);
      return;
    }

    for (const pet of pets) {
      const item = document.createElement('div');
      item.className = 'list-item';

      const head = document.createElement('div');
      head.className = 'item-head';
      const title = document.createElement('strong');
      title.textContent = `${pet.name} (${pet.species}${pet.breed ? ' · ' + pet.breed : ''})`;
      head.appendChild(title);

      const info = document.createElement('div');
      info.className = 'muted';
      const parts = [];
      if (pet.owners) parts.push(`Sahip: ${pet.owners.name} · 0${pet.owners.phone.slice(2)}`);
      if (pet.birth_date) parts.push('Doğum: ' + pet.birth_date);
      if (pet.gender) parts.push(pet.gender);
      if (pet.weight_kg) parts.push(pet.weight_kg + ' kg');
      info.textContent = parts.join(' · ');

      item.append(head, info);

      if (pet.birth_date) {
        const actions = document.createElement('div');
        actions.className = 'actions';
        const b = document.createElement('button');
        b.className = 'btn small';
        b.type = 'button';
        b.textContent = '💉 Aşı Planı Oluştur';
        b.addEventListener('click', async () => {
          b.disabled = true;
          try {
            const r = await api('/vaccinations/plan/' + pet.id, { method: 'POST' });
            showMessage($('#panel-message'), r.message, 'ok');
          } catch (err) {
            showMessage($('#panel-message'), err.message, 'error');
          } finally {
            b.disabled = false;
          }
        });
        actions.appendChild(b);
        item.appendChild(actions);
      }

      listEl.appendChild(item);
    }
  } catch (err) {
    showMessage($('#panel-message'), err.message, 'error');
  }
}

$('#patient-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await api('/patients', {
      method: 'POST',
      body: JSON.stringify({
        ownerName: f.get('ownerName'),
        phone: f.get('phone'),
        email: f.get('email'),
        petName: f.get('petName'),
        species: f.get('species'),
        breed: f.get('breed'),
        birthDate: f.get('birthDate'),
        gender: f.get('gender'),
        weightKg: f.get('weightKg'),
      }),
    });
    e.target.reset();
    showMessage($('#panel-message'), 'Hasta kaydedildi ✓', 'ok');
    loadPatients();
  } catch (err) {
    showMessage($('#panel-message'), err.message, 'error');
  }
});

// ---------- Aşı Takvimi ----------

const VACC_STATUS_TR = { scheduled: 'Planlandı', completed: 'Yapıldı', overdue: 'Gecikti', cancelled: 'İptal' };
const VACC_DATE_FMT = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

$('#vacc-status').addEventListener('change', loadVaccinations);
$('#vacc-days').addEventListener('change', loadVaccinations);

async function loadVaccinations() {
  const listEl = $('#vaccinations-list');
  listEl.textContent = 'Yükleniyor...';

  const params = new URLSearchParams();
  if ($('#vacc-status').value) params.set('status', $('#vacc-status').value);
  if ($('#vacc-days').value) params.set('days', $('#vacc-days').value);

  try {
    const { vaccinations } = await api('/vaccinations?' + params);
    listEl.textContent = '';

    if (!vaccinations.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'Bu filtrede aşı kaydı yok.';
      listEl.appendChild(p);
      return;
    }

    for (const v of vaccinations) {
      const item = document.createElement('div');
      item.className = 'list-item';

      const head = document.createElement('div');
      head.className = 'item-head';
      const title = document.createElement('strong');
      title.textContent = `${VACC_DATE_FMT.format(new Date(v.scheduled_date + 'T12:00:00Z'))} — ${v.vaccine_name}`;
      const badge = document.createElement('span');
      badge.className = 'badge ' + (v.status === 'overdue' ? 'no_show' : v.status === 'completed' ? 'completed' : v.status === 'cancelled' ? 'cancelled' : 'confirmed');
      badge.textContent = VACC_STATUS_TR[v.status] || v.status;
      head.append(title, badge);

      const info = document.createElement('div');
      info.className = 'muted';
      const bits = [];
      if (v.pets) bits.push(`${v.pets.name} (${v.pets.species})`);
      if (v.owner) bits.push(`Sahip: ${v.owner.name} · 0${v.owner.phone.slice(2)}`);
      if (v.completed_date) bits.push('Yapıldı: ' + v.completed_date);
      info.textContent = bits.join(' · ');

      item.append(head, info);

      if (v.status === 'scheduled' || v.status === 'overdue') {
        const actions = document.createElement('div');
        actions.className = 'actions';
        const done = document.createElement('button');
        done.className = 'btn small';
        done.type = 'button';
        done.textContent = '✓ Yapıldı';
        done.addEventListener('click', async () => {
          try {
            const r = await api('/vaccinations/' + v.id, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) });
            showMessage($('#panel-message'), r.nextDose ? 'Aşı yapıldı olarak işaretlendi; sonraki doz otomatik planlandı ✓' : 'Aşı yapıldı olarak işaretlendi ✓', 'ok');
            loadVaccinations();
          } catch (err) { showMessage($('#panel-message'), err.message, 'error'); }
        });
        const cancel = document.createElement('button');
        cancel.className = 'btn small';
        cancel.type = 'button';
        cancel.textContent = 'İptal';
        cancel.addEventListener('click', async () => {
          try {
            await api('/vaccinations/' + v.id, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) });
            loadVaccinations();
          } catch (err) { showMessage($('#panel-message'), err.message, 'error'); }
        });
        actions.append(done, cancel);
        item.appendChild(actions);
      }

      listEl.appendChild(item);
    }
  } catch (err) {
    listEl.textContent = '';
    showMessage($('#panel-message'), err.message, 'error');
  }
}

// ---------- Hatırlatmalar ----------

async function loadReminders() {
  const listEl = $('#reminders-list');
  listEl.textContent = 'Yükleniyor...';

  try {
    const { reminders } = await api('/reminders');
    listEl.textContent = '';

    if (!reminders.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'Şu an gönderilecek hatırlatma yok. 🎉';
      listEl.appendChild(p);
      return;
    }

    for (const r of reminders) {
      const item = document.createElement('div');
      item.className = 'list-item';
      if (r.alreadySent) item.style.opacity = '0.55';

      const head = document.createElement('div');
      head.className = 'item-head';
      const title = document.createElement('strong');
      title.textContent = (r.type === 'vaccination' ? '💉 ' : '📅 ') + `${r.petName} — ${r.label}`;
      const badge = document.createElement('span');
      if (r.alreadySent) { badge.className = 'badge completed'; badge.textContent = 'Gönderildi'; }
      else if (r.overdue) { badge.className = 'badge no_show'; badge.textContent = 'Gecikti'; }
      else { badge.className = 'badge pending'; badge.textContent = 'Bekliyor'; }
      head.append(title, badge);

      const info = document.createElement('div');
      info.className = 'muted';
      info.textContent = `${r.ownerName} · 0${r.phone.slice(2)}`;

      const msg = document.createElement('div');
      msg.className = 'muted';
      msg.style.marginTop = '6px';
      msg.style.fontStyle = 'italic';
      msg.textContent = '"' + r.message + '"';

      const actions = document.createElement('div');
      actions.className = 'actions';

      const wa = document.createElement('a');
      wa.className = 'btn small wa';
      wa.href = r.waLink;
      wa.target = '_blank';
      wa.rel = 'noopener';
      wa.textContent = '📲 WhatsApp ile Gönder';

      const mark = document.createElement('button');
      mark.className = 'btn small';
      mark.type = 'button';
      mark.textContent = r.alreadySent ? 'Tekrar işaretle' : '✓ Gönderildi olarak işaretle';
      mark.addEventListener('click', async () => {
        try {
          await api('/reminders/log', { method: 'POST', body: JSON.stringify({ type: r.type, id: r.id }) });
          loadReminders();
        } catch (err) { showMessage($('#panel-message'), err.message, 'error'); }
      });

      actions.append(wa, mark);
      item.append(head, info, msg, actions);
      listEl.appendChild(item);
    }
  } catch (err) {
    listEl.textContent = '';
    showMessage($('#panel-message'), err.message, 'error');
  }
}

// ---------- Klinik Ayarları ----------

async function loadClinic() {
  try {
    const { clinic } = await api('/clinic');
    const f = $('#clinic-form');
    f.name.value = clinic.name || '';
    f.city.value = clinic.city || '';
    f.district.value = clinic.district || '';
    f.address.value = clinic.address || '';
    f.phone.value = clinic.phone ? '0' + clinic.phone.slice(2) : '';
    f.whatsappNumber.value = clinic.whatsapp_number ? '0' + clinic.whatsapp_number.slice(2) : '';
    f.latitude.value = clinic.latitude ?? '';
    f.longitude.value = clinic.longitude ?? '';
    f.isOnDuty.checked = !!clinic.is_on_duty;
  } catch (err) {
    showMessage($('#panel-message'), err.message, 'error');
  }
}

// Google Maps'ten "41.015137, 28.979530" biçiminde tek parça yapıştırılırsa iki alana böl
$('#clinic-form').latitude.addEventListener('input', (e) => {
  const m = e.target.value.trim().match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
  if (m) {
    e.target.value = m[1];
    $('#clinic-form').longitude.value = m[2];
  }
});

$('#clinic-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    await api('/clinic', {
      method: 'PATCH',
      body: JSON.stringify({
        name: f.name.value,
        city: f.city.value,
        district: f.district.value,
        address: f.address.value,
        phone: f.phone.value,
        whatsappNumber: f.whatsappNumber.value,
        latitude: f.latitude.value.trim().replace(',', '.'),
        longitude: f.longitude.value.trim().replace(',', '.'),
        isOnDuty: f.isOnDuty.checked,
      }),
    });
    showMessage($('#panel-message'), 'Klinik bilgileri kaydedildi ✓', 'ok');
  } catch (err) {
    showMessage($('#panel-message'), err.message, 'error');
  }
});

// ---------- Başlangıç ----------

(async function init() {
  if (!state.token) return showAuth();
  try {
    const data = await api('/auth/me');
    state.clinic = data.clinic;
    showPanel();
  } catch {
    showAuth();
  }
})();
