/**
 * builder.js — Form Builder state + rendering
 */

let schema = null;
let editingFieldId = null;

/* ── Boot ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  const id = new URLSearchParams(location.search).get('id');

  // 1. Try localStorage
  schema = (id ? loadFormById(id) : null) || loadCurrentSchema() || createBlankSchema();

  // 2. Appwrite fallback for edit links shared across devices
  if (id && (!schema || schema.id !== id) && typeof loadFormFromAppwrite === 'function') {
    try {
      const remote = await loadFormFromAppwrite(id);
      if (remote) { schema = remote; saveForm(remote); }
    } catch (e) { console.error('Builder: Appwrite fetch failed', e); }
  }

  renderAll();
  bindGlobalEvents();
  updateAutoSaveLabel();
});

/* ── Render ──────────────────────────────────────────────── */
function renderAll() {
  document.getElementById('form-title').value = schema.title || '';
  document.getElementById('form-desc').value  = schema.description || '';
  document.getElementById('field-count').textContent = schema.fields.length;
  document.getElementById('rule-count').textContent  = schema.logic.length;
  // Populate form settings
  const activeEl  = document.getElementById('form-active');
  const closeAtEl = document.getElementById('form-close-at');
  if (activeEl)  activeEl.checked  = schema.isActive !== false; // default true
  if (closeAtEl) closeAtEl.value   = schema.closeAt ? schema.closeAt.slice(0, 16) : '';
  renderFieldList();
  renderRuleList();
  populateRuleSelects();
}

function renderFieldList() {
  const el = document.getElementById('fields-list');
  const empty = document.getElementById('fields-empty');
  if (!schema.fields.length) { el.innerHTML=''; empty?.classList.remove('hidden'); return; }
  empty?.classList.add('hidden');
  el.innerHTML = schema.fields.map((f,i) => {
    const meta = getFieldMeta(f.type);
    return `
    <div class="field-row group flex items-center gap-3 bg-slate-800/80 border border-slate-700 hover:border-violet-500/50 rounded-xl px-4 py-3 transition-all duration-200 cursor-default" data-id="${f.id}">
      <span class="w-8 h-8 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center text-xs font-bold flex-shrink-0">${meta.icon}</span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-white truncate">${sanitize(f.label||'Untitled')}</p>
        <p class="text-xs text-slate-500 mt-0.5">${meta.label}${f.required?' · <span class="text-rose-400">Required</span>':''}</p>
      </div>
      <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        ${i>0?`<button onclick="moveField('${f.id}',-1)" class="btn-icon" title="Up">↑</button>`:''}
        ${i<schema.fields.length-1?`<button onclick="moveField('${f.id}',1)" class="btn-icon" title="Down">↓</button>`:''}
        <button onclick="editField('${f.id}')" class="btn-icon text-violet-400" title="Edit">✎</button>
        <button onclick="deleteField('${f.id}')" class="btn-icon text-rose-400" title="Delete">✕</button>
      </div>
    </div>`;
  }).join('');
}

function renderRuleList() {
  const el = document.getElementById('rules-list');
  const empty = document.getElementById('rules-empty');
  if (!schema.logic.length) { el.innerHTML=''; empty?.classList.remove('hidden'); return; }
  empty?.classList.add('hidden');
  el.innerHTML = schema.logic.map(r => `
    <div class="group flex items-center gap-3 bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 transition-all">
      <span class="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0"></span>
      <p class="flex-1 text-xs text-slate-300 leading-relaxed">${sanitize(describeRule(r, schema.fields))}</p>
      <button onclick="deleteRule('${r.id}')" class="btn-icon text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">✕</button>
    </div>`).join('');
}

function populateRuleSelects() {
  const opts = ['<option value="">— Field —</option>',
    ...schema.fields.map(f => `<option value="${f.id}">${sanitize(f.label||'Untitled')}</option>`)
  ].join('');
  document.getElementById('rule-source').innerHTML = opts;
  document.getElementById('rule-target').innerHTML = opts;
}

/* ── Field Panel ─────────────────────────────────────────── */
function openAddPanel() {
  editingFieldId = null;
  document.getElementById('panel-title').textContent = 'Add Field';
  document.getElementById('field-form').reset();
  document.getElementById('field-type').value = 'text';
  toggleDropdownGroup(false);
  openPanel();
}

function editField(id) {
  const f = schema.fields.find(f => f.id === id);
  if (!f) return;
  editingFieldId = id;
  document.getElementById('panel-title').textContent = 'Edit Field';
  document.getElementById('field-type').value = f.type;
  document.getElementById('field-label').value = f.label || '';
  document.getElementById('field-placeholder').value = f.placeholder || '';
  document.getElementById('field-required').checked = !!f.required;
  const isDrop = f.type === 'dropdown';
  toggleDropdownGroup(isDrop);
  if (isDrop) document.getElementById('field-options').value = (f.options||[]).join('\n');
  openPanel();
}

function openPanel() {
  document.getElementById('field-panel').classList.remove('translate-x-full');
  document.getElementById('panel-overlay').classList.remove('hidden');
}

function closePanel() {
  document.getElementById('field-panel').classList.add('translate-x-full');
  document.getElementById('panel-overlay').classList.add('hidden');
  editingFieldId = null;
}

function toggleDropdownGroup(show) {
  document.getElementById('dropdown-group').classList.toggle('hidden', !show);
}

/* ── Field CRUD ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('field-type').addEventListener('change', e => toggleDropdownGroup(e.target.value==='dropdown'));

  document.getElementById('field-form').addEventListener('submit', e => {
    e.preventDefault();
    const type  = document.getElementById('field-type').value;
    const label = document.getElementById('field-label').value.trim();
    if (!label) { showToast('Label is required','error'); return; }
    const field = {
      type, label,
      placeholder: document.getElementById('field-placeholder').value.trim(),
      required: document.getElementById('field-required').checked,
    };
    if (type === 'dropdown') {
      field.options = document.getElementById('field-options').value.split('\n').map(o=>o.trim()).filter(Boolean);
      if (!field.options.length) { showToast('Add at least one option','error'); return; }
    }
    if (editingFieldId) {
      const idx = schema.fields.findIndex(f => f.id === editingFieldId);
      if (idx>=0) schema.fields[idx] = { ...schema.fields[idx], ...field };
      showToast('Field updated');
    } else {
      schema.fields.push({ id:generateId(), ...field });
      showToast('Field added');
    }
    closePanel(); autoSave(); renderAll();
  });
});

function deleteField(id) {
  showConfirmModal('Delete Field','Rules referencing this field will also be removed.',() => {
    schema.fields = schema.fields.filter(f=>f.id!==id);
    schema.logic  = schema.logic.filter(r=>r.sourceFieldId!==id&&r.targetFieldId!==id);
    autoSave(); renderAll(); showToast('Field deleted');
  });
}

function moveField(id, dir) {
  const i = schema.fields.findIndex(f=>f.id===id);
  const j = i + dir;
  if (j<0||j>=schema.fields.length) return;
  [schema.fields[i],schema.fields[j]] = [schema.fields[j],schema.fields[i]];
  autoSave(); renderFieldList(); updateCounts();
}

/* ── Logic Rules ─────────────────────────────────────────── */
function addRule() {
  const rule = {
    id:            generateId(),
    sourceFieldId: document.getElementById('rule-source').value,
    operator:      document.getElementById('rule-operator').value,
    value:         document.getElementById('rule-value').value.trim(),
    action:        'show',
    targetFieldId: document.getElementById('rule-target').value,
  };
  const { valid, error } = validateRule(rule, schema.fields);
  if (!valid) { showToast(error,'error'); return; }
  schema.logic.push(rule);
  autoSave(); renderAll();
  document.getElementById('rule-source').value='';
  document.getElementById('rule-operator').innerHTML='<option value="">— Operator —</option>';
  document.getElementById('rule-value').value='';
  document.getElementById('rule-target').value='';
  document.getElementById('rule-value-row').classList.add('hidden');
  showToast('Logic rule added','info');
}

function deleteRule(id) {
  schema.logic = schema.logic.filter(r=>r.id!==id);
  autoSave(); renderAll(); showToast('Rule removed');
}

/* ── Global Events ───────────────────────────────────────── */
function bindGlobalEvents() {
  const debouncedSave = debounce(() => autoSave(), 400);

  document.getElementById('form-title').addEventListener('input', e => {
    schema.title = e.target.value || 'Untitled Form'; debouncedSave();
  });
  document.getElementById('form-desc').addEventListener('input', e => {
    schema.description = e.target.value; debouncedSave();
  });
  // Form open/close settings
  const formActiveEl  = document.getElementById('form-active');
  const formCloseAtEl = document.getElementById('form-close-at');
  if (formActiveEl)  formActiveEl.addEventListener('change',  e => { schema.isActive = e.target.checked; debouncedSave(); });
  if (formCloseAtEl) formCloseAtEl.addEventListener('change', e => {
    schema.closeAt = e.target.value ? new Date(e.target.value).toISOString() : null;
    debouncedSave();
  });
  document.getElementById('btn-add-field').addEventListener('click', openAddPanel);
  document.getElementById('field-panel-close').addEventListener('click', closePanel);
  document.getElementById('panel-overlay').addEventListener('click', closePanel);
  document.getElementById('btn-save').addEventListener('click', saveAction);
  document.getElementById('btn-preview').addEventListener('click', () => {
    saveAction(false); window.location.href = `preview.html?id=${schema.id}`;
  });
  document.getElementById('btn-share').addEventListener('click', copyShareLink);
  document.getElementById('btn-add-rule').addEventListener('click', addRule);

  document.getElementById('rule-source').addEventListener('change', function() {
    const f = schema.fields.find(f=>f.id===this.value);
    if (!f) return;
    const ops = getOperatorsForFieldType(f.type);
    document.getElementById('rule-operator').innerHTML =
      '<option value="">— Operator —</option>' +
      ops.map(o=>`<option value="${o.value}">${o.label}</option>`).join('');
    document.getElementById('rule-value-row').classList.toggle('hidden', f.type==='checkbox');
  });

  document.getElementById('rule-operator').addEventListener('change', function() {
    const noVal = ['is_checked','is_not_checked'].includes(this.value);
    document.getElementById('rule-value-row').classList.toggle('hidden', noVal);
  });
}

/* ── Save / Share ────────────────────────────────────────── */
function saveAction(toast=true) {
  if (!schema.title.trim()) { showToast('Add a form title first','error'); return; }
  // Ensure isActive has a default
  if (typeof schema.isActive !== 'boolean') schema.isActive = true;
  // Stamp ownership
  schema.ownerId = localStorage.getItem('userId') || schema.ownerId || 'anonymous';
  saveForm(schema); saveCurrentSchema(schema);
  // Also persist to Appwrite (non-blocking)
  if (typeof saveFormToAppwrite === 'function') {
    saveFormToAppwrite(schema)
      .then(ok => { if (!ok) showToast('Saved locally (Appwrite unavailable)','warning'); })
      .catch(() => {});
  }
  if (toast) showToast('Saved successfully!');
  updateAutoSaveLabel();
}

function autoSave() { saveCurrentSchema(schema); updateAutoSaveLabel(); }

function updateAutoSaveLabel() {
  const el = document.getElementById('autosave-label');
  if (el) el.textContent = 'Saved ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}

function copyShareLink() {
  const encoded = encodeSchemaToURL(schema);
  if (!encoded) { showToast('Could not encode form','error'); return; }
  const url = location.href.replace('builder.html','form.html') + `?schema=${encoded}`;
  copyToClipboard(url).then(() => showToast('Share link copied!','info'));
}

function updateCounts() {
  document.getElementById('field-count').textContent = schema.fields.length;
  document.getElementById('rule-count').textContent  = schema.logic.length;
}
