// DEMO MODU: Supabase'i taklit eden yerel sunucu.
// Veriler bellekte tutulur; sunucu kapaninca SILINIR. Sadece deneme icindir.
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const users = []; // {id, email, password}
const tables = { clinics: [], clinic_users: [], owners: [], pets: [], appointments: [], vaccine_templates: [], pet_vaccinations: [], reminders_log: [] };
const FK = { pets: 'pet_id', owners: 'owner_id', clinics: 'clinic_id' };

// Demo modunda aşı şablonları hazır gelsin
for (const tpl of require('../data/vaccine-templates')) {
  tables.vaccine_templates.push({ id: crypto.randomUUID(), ...tpl });
}

// ---- Auth uclari ----
app.post('/auth/v1/admin/users', (req, res) => {
  const { email, password } = req.body;
  if (users.find(u => u.email === email)) {
    return res.status(422).json({ code: 422, msg: 'A user with this email address has already been registered' });
  }
  const user = { id: crypto.randomUUID(), email, password };
  users.push(user);
  res.json({ id: user.id, email });
});

app.delete('/auth/v1/admin/users/:id', (req, res) => {
  const i = users.findIndex(u => u.id === req.params.id);
  if (i >= 0) users.splice(i, 1);
  res.json({});
});

app.post('/auth/v1/token', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid login credentials' });
  const token = 'tok_' + user.id;
  res.json({
    access_token: token, token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400,
    refresh_token: 'ref_' + user.id, user: { id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated' },
  });
});

app.get('/auth/v1/user', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user = users.find(u => 'tok_' + u.id === token);
  if (!user) return res.status(401).json({ code: 401, msg: 'invalid JWT' });
  res.json({ id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated' });
});

// ---- PostgREST uclari ----
function applyFilters(rows, query) {
  let out = [...rows];
  for (const [key, raw] of Object.entries(query)) {
    if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
    const vals = Array.isArray(raw) ? raw : [raw];
    for (const val of vals) {
      const dot = val.indexOf('.');
      const op = val.slice(0, dot), arg = val.slice(dot + 1);
      if (op === 'eq') out = out.filter(r => String(r[key]) === arg);
      else if (op === 'gte') out = out.filter(r => r[key] >= arg);
      else if (op === 'lte') out = out.filter(r => r[key] <= arg);
      else if (op === 'lt') out = out.filter(r => r[key] < arg);
      else if (op === 'gt') out = out.filter(r => r[key] > arg);
      else if (op === 'in') {
        const set = new Set(arg.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')));
        out = out.filter(r => set.has(String(r[key])));
      }
      else if (op === 'ilike') {
        const re = new RegExp('^' + arg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*') + '$', 'i');
        out = out.filter(r => re.test(String(r[key])));
      }
    }
  }
  return out;
}

function applyEmbeds(rows, select) {
  if (!select) return rows;
  const embeds = [...select.matchAll(/(\w+)\(([^)]*)\)/g)];
  if (!embeds.length) return rows;
  return rows.map(r => {
    const copy = { ...r };
    for (const [, embTable] of embeds) {
      const fk = FK[embTable];
      const related = (tables[embTable] || []).find(x => x.id === r[fk]);
      copy[embTable] = related ? { ...related } : null;
    }
    return copy;
  });
}

function wantsObject(req) {
  return (req.headers.accept || '').includes('vnd.pgrst.object');
}

app.get('/rest/v1/:table', (req, res) => {
  const rows0 = tables[req.params.table];
  if (!rows0) return res.status(404).json({ message: 'relation not found' });
  let rows = applyFilters(rows0, req.query);
  if (req.query.order) {
    const [col, dir] = req.query.order.split('.');
    rows.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (dir === 'desc' ? -1 : 1));
  }
  if (req.query.limit) rows = rows.slice(0, Number(req.query.limit));
  rows = applyEmbeds(rows, req.query.select);
  if (wantsObject(req)) {
    if (rows.length !== 1) return res.status(406).json({ code: 'PGRST116', details: rows.length + ' rows', message: 'JSON object requested, multiple (or no) rows returned' });
    return res.json(rows[0]);
  }
  res.json(rows);
});

app.post('/rest/v1/:table', (req, res) => {
  const rows = tables[req.params.table];
  if (!rows) return res.status(404).json({ message: 'relation not found' });
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const created = items.map(item => {
    const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...item };
    if (req.params.table === 'reminders_log' && !row.sent_at) row.sent_at = new Date().toISOString();
    rows.push(row);
    return row;
  });
  if (wantsObject(req)) return res.status(201).json(created[0]);
  res.status(201).json(created);
});

app.patch('/rest/v1/:table', (req, res) => {
  const rows = tables[req.params.table];
  if (!rows) return res.status(404).json({ message: 'relation not found' });
  const matched = applyFilters(rows, req.query);
  matched.forEach(r => Object.assign(r, req.body));
  if (wantsObject(req)) {
    if (matched.length !== 1) return res.status(406).json({ code: 'PGRST116', details: matched.length + ' rows', message: 'JSON object requested, multiple (or no) rows returned' });
    return res.json(matched[0]);
  }
  res.json(matched);
});

app.delete('/rest/v1/:table', (req, res) => {
  const rows = tables[req.params.table];
  if (!rows) return res.status(404).json({ message: 'relation not found' });
  const matched = applyFilters(rows, req.query);
  for (const m of matched) rows.splice(rows.indexOf(m), 1);
  res.json(matched);
});

const MOCK_PORT = 54321;
module.exports = new Promise((resolve) => {
  app.listen(MOCK_PORT, () => resolve(MOCK_PORT));
});
