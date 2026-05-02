/**
 * storage.js — Centralized localStorage layer
 * All persistence goes through this module.
 */

const KEYS = {
  FORMS: 'fc_forms',
  CURRENT: 'fc_current',
  RESPONSES: 'fc_responses',
};

/* ── Utilities ─────────────────────────────────────────── */

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function createBlankSchema(title = 'Untitled Form') {
  return {
    id: generateId(),
    title,
    description: '',
    fields: [],
    logic: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/* ── Current Working Form ──────────────────────────────── */

function saveCurrentSchema(schema) {
  schema.updatedAt = new Date().toISOString();
  localStorage.setItem(KEYS.CURRENT, JSON.stringify(schema));
}

function loadCurrentSchema() {
  try {
    const raw = localStorage.getItem(KEYS.CURRENT);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/* ── Forms Collection ──────────────────────────────────── */

function getAllForms() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.FORMS) || '[]');
  } catch { return []; }
}

function saveForm(schema) {
  schema.updatedAt = new Date().toISOString();
  const forms = getAllForms();
  const idx = forms.findIndex(f => f.id === schema.id);
  idx >= 0 ? (forms[idx] = schema) : forms.unshift(schema);
  localStorage.setItem(KEYS.FORMS, JSON.stringify(forms));
}

function deleteForm(id) {
  const forms = getAllForms().filter(f => f.id !== id);
  localStorage.setItem(KEYS.FORMS, JSON.stringify(forms));
}

function loadFormById(id) {
  const form = getAllForms().find(f => f.id === id) || null;
  if (form) saveCurrentSchema(form);
  return form;
}

/* ── Responses ─────────────────────────────────────────── */

function saveResponse(formId, data) {
  let all = {};
  try { all = JSON.parse(localStorage.getItem(KEYS.RESPONSES) || '{}'); } catch {}
  if (!all[formId]) all[formId] = [];
  all[formId].push({ id: generateId(), submittedAt: new Date().toISOString(), data });
  localStorage.setItem(KEYS.RESPONSES, JSON.stringify(all));
}

function getResponses(formId) {
  try {
    const all = JSON.parse(localStorage.getItem(KEYS.RESPONSES) || '{}');
    return all[formId] || [];
  } catch { return []; }
}

/* ── URL Share ─────────────────────────────────────────── */

function encodeSchemaToURL(schema) {
  try { return btoa(encodeURIComponent(JSON.stringify(schema))); }
  catch { return null; }
}

function decodeSchemaFromURL(encoded) {
  try { return JSON.parse(decodeURIComponent(atob(encoded))); }
  catch { return null; }
}

/* ── Export ────────────────────────────────────────────── */

function exportSchemaAsJSON(schema) {
  _download(JSON.stringify(schema, null, 2), `${_slug(schema.title)}_schema.json`);
}

function exportResponseAsJSON(data, title) {
  _download(JSON.stringify(data, null, 2), `${_slug(title || 'response')}_response.json`);
}

function _download(content, filename) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: 'application/json' })),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

function _slug(str) {
  return (str || 'file').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
}
