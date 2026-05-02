/**
 * app.js — Shared utilities, toast, modal, constants
 */

/* ── Toast ───────────────────────────────────────────────── */
function showToast(msg, type = 'success') {
  const ct = document.getElementById('toast-container');
  if (!ct) return;
  const cfg = {
    success: { bg: 'bg-emerald-500', icon: '✓' },
    error:   { bg: 'bg-red-500',     icon: '✕' },
    info:    { bg: 'bg-violet-500',  icon: 'ℹ' },
    warning: { bg: 'bg-amber-500',   icon: '⚠' },
  }[type] || { bg: 'bg-slate-600', icon: '•' };

  const el = document.createElement('div');
  el.className = `flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-2xl ${cfg.bg} translate-x-full transition-all duration-300 max-w-xs`;
  el.innerHTML = `<span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold flex-shrink-0">${cfg.icon}</span><span>${msg}</span>`;
  ct.appendChild(el);
  requestAnimationFrame(() => el.classList.remove('translate-x-full'));
  setTimeout(() => { el.classList.add('translate-x-full'); setTimeout(() => el.remove(), 300); }, 3200);
}

/* ── Confirm Modal ───────────────────────────────────────── */
function showConfirmModal(title, msg, onConfirm, confirmLabel = 'Delete', confirmClass = 'bg-red-500 hover:bg-red-600') {
  document.getElementById('confirm-modal')?.remove();
  const m = document.createElement('div');
  m.id = 'confirm-modal';
  m.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm';
  m.innerHTML = `
    <div class="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl scale-95 transition-transform duration-200">
      <h3 class="text-base font-semibold text-white mb-2">${title}</h3>
      <p class="text-slate-400 text-sm mb-6">${msg}</p>
      <div class="flex gap-3 justify-end">
        <button id="cm-cancel" class="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors">Cancel</button>
        <button id="cm-ok" class="px-4 py-2 rounded-lg text-sm font-medium text-white ${confirmClass} transition-colors">${confirmLabel}</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  requestAnimationFrame(() => m.querySelector('div').classList.replace('scale-95','scale-100'));
  m.querySelector('#cm-cancel').onclick = () => m.remove();
  m.querySelector('#cm-ok').onclick = () => { onConfirm(); m.remove(); };
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
}

/* ── Utilities ───────────────────────────────────────────── */
function sanitize(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function debounce(fn, ms = 300) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function copyToClipboard(text) {
  return navigator.clipboard?.writeText(text).catch(() => {
    const ta = Object.assign(document.createElement('textarea'), { value: text, style: 'position:fixed;opacity:0' });
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  });
}

function getInitials(t) {
  return (t||'F').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
}

/* ── Field Type Registry ─────────────────────────────────── */
const FIELD_TYPES = [
  { value:'text',     label:'Short Text', icon:'Aa' },
  { value:'textarea', label:'Long Text',  icon:'¶'  },
  { value:'number',   label:'Number',     icon:'#'  },
  { value:'email',    label:'Email',      icon:'@'  },
  { value:'dropdown', label:'Dropdown',   icon:'▾'  },
  { value:'checkbox', label:'Checkbox',   icon:'✓'  },
];

function getFieldMeta(type) {
  return FIELD_TYPES.find(t => t.value === type) || { value:type, label:type, icon:'?' };
}
