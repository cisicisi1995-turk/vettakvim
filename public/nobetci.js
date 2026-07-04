// Nöbetçi veteriner bulucu — herkese açık sayfa (giriş gerektirmez)
// XSS: tüm dinamik içerik textContent ile yazılır.

const $ = (sel) => document.querySelector(sel);
let map = null;
let markers = [];

const TODAY_FMT = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
$('#date-line').textContent = TODAY_FMT.format(new Date()) + ' — bugün nöbetçi olan klinikler';

function fmtPhone(p) {
  // 905321234567 -> 0532 123 45 67
  if (!p || p.length !== 12) return p || '';
  return '0' + p.slice(2, 5) + ' ' + p.slice(5, 8) + ' ' + p.slice(8, 10) + ' ' + p.slice(10);
}

async function loadCities() {
  try {
    const res = await fetch('/api/public/cities');
    const { cities } = await res.json();
    const sel = $('#city');
    for (const c of cities) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    }
  } catch {
    showEmpty('Şehir listesi yüklenemedi. Sayfayı yenileyin.');
  }
}

function showEmpty(text) {
  const results = $('#results');
  results.textContent = '';
  const p = document.createElement('p');
  p.className = 'empty';
  p.textContent = text;
  results.appendChild(p);
}

function renderMap(clinics) {
  const withCoords = clinics.filter((c) => c.latitude && c.longitude);
  const mapEl = $('#map');

  if (!withCoords.length) {
    mapEl.style.display = 'none';
    return;
  }
  mapEl.style.display = 'block';

  if (!map) {
    map = L.map('map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
  }
  markers.forEach((m) => m.remove());
  markers = [];

  const bounds = [];
  for (const c of withCoords) {
    const m = L.marker([Number(c.latitude), Number(c.longitude)]).addTo(map);
    m.bindPopup(`<strong>${c.name.replace(/</g, '&lt;')}</strong><br>${(c.address || '').replace(/</g, '&lt;')}`);
    markers.push(m);
    bounds.push([Number(c.latitude), Number(c.longitude)]);
  }
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  setTimeout(() => map.invalidateSize(), 100);
}

async function search(city) {
  const results = $('#results');
  results.textContent = 'Aranıyor...';

  try {
    const res = await fetch('/api/public/on-duty?city=' + encodeURIComponent(city));
    const { clinics } = await res.json();
    results.textContent = '';

    renderMap(clinics);

    if (!clinics.length) {
      showEmpty(`${city} için bugün kayıtlı nöbetçi klinik bulunamadı. Acil durumda en yakın hayvan hastanesini arayın.`);
      return;
    }

    for (const c of clinics) {
      const item = document.createElement('div');
      item.className = 'list-item clinic-card';

      const head = document.createElement('div');
      head.className = 'item-head';
      const title = document.createElement('strong');
      title.textContent = '🏥 ' + c.name;
      const badge = document.createElement('span');
      badge.className = 'badge confirmed';
      badge.textContent = 'Nöbetçi';
      head.append(title, badge);

      const info = document.createElement('div');
      info.className = 'muted';
      info.textContent = [c.district, c.address].filter(Boolean).join(' · ') || c.city;

      const actions = document.createElement('div');
      actions.className = 'actions';

      if (c.phone) {
        const call = document.createElement('a');
        call.className = 'btn small';
        call.href = 'tel:+' + c.phone;
        call.textContent = '📞 Ara: ' + fmtPhone(c.phone);
        actions.appendChild(call);
      }
      if (c.whatsapp_number) {
        const wa = document.createElement('a');
        wa.className = 'btn small wa';
        wa.href = 'https://wa.me/' + c.whatsapp_number;
        wa.target = '_blank';
        wa.rel = 'noopener';
        wa.textContent = '💬 WhatsApp';
        actions.appendChild(wa);
      }
      if (c.latitude && c.longitude) {
        const dir = document.createElement('a');
        dir.className = 'btn small';
        dir.href = `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`;
        dir.target = '_blank';
        dir.rel = 'noopener';
        dir.textContent = '🗺️ Yol Tarifi';
        actions.appendChild(dir);
      }

      item.append(head, info, actions);
      results.appendChild(item);
    }
  } catch {
    showEmpty('Bir hata oluştu. Lütfen tekrar deneyin.');
  }
}

$('#city').addEventListener('change', (e) => {
  if (e.target.value) search(e.target.value);
});

loadCities();
