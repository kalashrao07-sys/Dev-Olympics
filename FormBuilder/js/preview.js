/**
 * preview.js — Live preview rendering with logic inspector
 */

let schema = null;
let previewValues = {};

document.addEventListener('DOMContentLoaded', async () => {
  const id = new URLSearchParams(location.search).get('id');

  // 1. localStorage first
  schema = (id ? loadFormById(id) : null) || loadCurrentSchema();

  // 2. Appwrite fallback if not found locally
  if (!schema && id && typeof loadFormFromAppwrite === 'function') {
    try {
      schema = await loadFormFromAppwrite(id);
      if (schema) saveForm(schema); // cache locally
    } catch (e) { console.error('Preview: Appwrite fetch failed', e); }
  }

  if (!schema) { showNoForm(); return; }
  document.title = `Preview — ${schema.title}`;
  document.getElementById('preview-title').textContent = schema.title;
  document.getElementById('preview-desc').textContent  = schema.description || '';
  document.getElementById('edit-link').href = `builder.html?id=${schema.id}`;
  document.getElementById('public-link').onclick = () => window.open(`form.html?id=${schema.id}`,'_blank');
  renderPreviewForm();
  renderLogicInspector();
  document.getElementById('btn-reset').addEventListener('click', resetPreview);
});

function showNoForm() {
  document.getElementById('preview-area').innerHTML = `
    <div class="text-center py-20">
      <p class="text-slate-400 mb-4">No form loaded.</p>
      <a href="builder.html" class="text-violet-400 hover:underline">← Back to builder</a>
    </div>`;
}

/* ── Render Form Fields ──────────────────────────────────── */
function renderPreviewForm() {
  const visible = evaluateLogic(schema.fields, schema.logic, previewValues);
  const container = document.getElementById('preview-fields');
  container.innerHTML = '';

  schema.fields.forEach(field => {
    const isVis = visible.has(field.id);
    const wrap = buildInput(field);
    wrap.dataset.fieldId = field.id;
    wrap.className = `preview-field transition-all duration-300 mb-5 ${isVis?'':'opacity-0 pointer-events-none h-0 overflow-hidden mb-0'}`;
    container.appendChild(wrap);
  });

  container.querySelectorAll('input,select,textarea').forEach(inp => {
    inp.addEventListener('input', onPreviewChange);
    inp.addEventListener('change', onPreviewChange);
  });

  renderLogicInspector();
}

function onPreviewChange(e) {
  const wrapper = e.target.closest('[data-field-id]');
  if (!wrapper) return;
  const fid = wrapper.dataset.fieldId;
  previewValues[fid] = e.target.type==='checkbox' ? e.target.checked : e.target.value;
  updatePreviewVisibility();
  renderLogicInspector();
  updateLiveValues();
}

function updatePreviewVisibility() {
  const visible = evaluateLogic(schema.fields, schema.logic, previewValues);
  document.querySelectorAll('.preview-field').forEach(el => {
    const show = visible.has(el.dataset.fieldId);
    el.classList.toggle('opacity-0', !show);
    el.classList.toggle('pointer-events-none', !show);
    el.classList.toggle('h-0', !show);
    el.classList.toggle('overflow-hidden', !show);
    el.classList.toggle('mb-0', !show);
    el.classList.toggle('mb-5', show);
  });
}

function buildInput(field) {
  const wrap = document.createElement('div');
  const labelHtml = `<label class="block text-sm font-medium text-slate-300 mb-2">${sanitize(field.label)}${field.required?' <span class="text-rose-400">*</span>':''}</label>`;

  const cls = 'w-full bg-slate-700/60 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all';

  let body = '';
  switch(field.type) {
    case 'textarea':
      body = `<textarea class="${cls}" placeholder="${sanitize(field.placeholder||'')}" rows="3"></textarea>`; break;
    case 'dropdown':
      body = `<select class="${cls}"><option value="">Select…</option>${(field.options||[]).map(o=>`<option value="${sanitize(o)}">${sanitize(o)}</option>`).join('')}</select>`; break;
    case 'checkbox':
      body = `<label class="flex items-center gap-3 cursor-pointer"><input type="checkbox" class="w-4 h-4 rounded accent-violet-500"/><span class="text-sm text-slate-300">${sanitize(field.placeholder||field.label)}</span></label>`; break;
    default:
      body = `<input type="${field.type==='email'?'email':field.type==='number'?'number':'text'}" class="${cls}" placeholder="${sanitize(field.placeholder||'')}"/>`; break;
  }
  wrap.innerHTML = labelHtml + body;
  return wrap;
}

/* ── Logic Inspector ─────────────────────────────────────── */
function renderLogicInspector() {
  const li = document.getElementById('logic-inspector');
  if (!li || !schema) return;
  if (!schema.logic.length) { li.innerHTML='<p class="text-xs text-slate-500">No rules defined.</p>'; return; }
  li.innerHTML = schema.logic.map(r => {
    const active = evaluateCondition(r, previewValues);
    return `<div class="flex items-start gap-2 p-2 rounded-lg ${active?'bg-violet-500/10 border border-violet-500/20':'bg-slate-700/30'} text-xs mb-2">
      <span class="mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${active?'bg-violet-400':'bg-slate-600'}"></span>
      <span class="${active?'text-violet-300':'text-slate-500'}">${sanitize(describeRule(r, schema.fields))}</span>
    </div>`;
  }).join('');
}

function updateLiveValues() {
  const el = document.getElementById('live-values');
  if (!el) return;
  const entries = Object.entries(previewValues).filter(([,v])=>v!==''&&v!==undefined);
  if (!entries.length) { el.innerHTML='<p class="text-xs text-slate-500">No values yet.</p>'; return; }
  el.innerHTML = entries.map(([k,v]) => {
    const f = schema.fields.find(f=>f.id===k);
    return `<div class="flex justify-between text-xs gap-2 py-1 border-b border-slate-700/50">
      <span class="text-slate-500 truncate">${sanitize(f?.label||k)}</span>
      <span class="text-emerald-400 font-mono">${sanitize(String(v))}</span>
    </div>`;
  }).join('');
}

function resetPreview() {
  previewValues = {};
  renderPreviewForm();
  updateLiveValues();
  showToast('Reset','info');
}
