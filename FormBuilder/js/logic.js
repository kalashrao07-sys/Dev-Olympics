/**
 * logic.js — Conditional Logic Engine
 */

function evaluateLogic(fields, rules, values) {
  const targeted = new Set(
    rules.filter(r => r.action === 'show' && r.targetFieldId).map(r => r.targetFieldId)
  );
  const alwaysVisible = new Set(fields.filter(f => !targeted.has(f.id)).map(f => f.id));
  const fromRules = new Set(
    rules.filter(r => r.action === 'show' && r.targetFieldId && _evalRule(r, values)).map(r => r.targetFieldId)
  );
  return new Set([...alwaysVisible, ...fromRules]);
}

function evaluateCondition(rule, values) { return _evalRule(rule, values); }

function _evalRule(rule, values) {
  const { sourceFieldId, operator, value: rv } = rule;
  if (!sourceFieldId || !operator) return false;
  const av = values[sourceFieldId];
  switch (operator) {
    case 'equals':      return String(av ?? '').trim().toLowerCase() === String(rv ?? '').trim().toLowerCase();
    case 'not_equals':  return String(av ?? '').trim().toLowerCase() !== String(rv ?? '').trim().toLowerCase();
    case 'greater_than':{ const [n,m]=[parseFloat(av),parseFloat(rv)]; return !isNaN(n)&&!isNaN(m)&&n>m; }
    case 'less_than':   { const [n,m]=[parseFloat(av),parseFloat(rv)]; return !isNaN(n)&&!isNaN(m)&&n<m; }
    case 'contains':    return String(av??'').toLowerCase().includes(String(rv??'').toLowerCase());
    case 'is_checked':  return av===true||av==='true';
    case 'is_not_checked': return av!==true&&av!=='true';
    default: return false;
  }
}

function describeRule(rule, fields) {
  const src = fields.find(f => f.id === rule.sourceFieldId);
  const tgt = fields.find(f => f.id === rule.targetFieldId);
  if (!src || !tgt) return 'Invalid rule';
  const ops = { equals:'equals', not_equals:'≠', greater_than:'>', less_than:'<', contains:'contains', is_checked:'is checked', is_not_checked:'is not checked' };
  const noVal = ['is_checked','is_not_checked'].includes(rule.operator);
  return `IF "${src.label}" ${ops[rule.operator]||rule.operator}${noVal?'':` "${rule.value}"`} → SHOW "${tgt.label}"`;
}

function validateRule(rule, fields) {
  if (!rule.sourceFieldId) return { valid:false, error:'Select a source field' };
  if (!rule.operator)      return { valid:false, error:'Select an operator' };
  if (!rule.targetFieldId) return { valid:false, error:'Select a target field' };
  if (rule.sourceFieldId===rule.targetFieldId) return { valid:false, error:'Source and target must differ' };
  if (!['is_checked','is_not_checked'].includes(rule.operator) && !String(rule.value??'').trim())
    return { valid:false, error:'Enter a comparison value' };
  return { valid:true, error:null };
}

function getOperatorsForFieldType(type) {
  switch (type) {
    case 'number':   return [{value:'equals',label:'= equals'},{value:'not_equals',label:'≠ not equals'},{value:'greater_than',label:'> greater than'},{value:'less_than',label:'< less than'}];
    case 'checkbox': return [{value:'is_checked',label:'✓ is checked'},{value:'is_not_checked',label:'✗ is not checked'}];
    case 'dropdown': return [{value:'equals',label:'= equals'},{value:'not_equals',label:'≠ not equals'}];
    default:         return [{value:'equals',label:'= equals'},{value:'not_equals',label:'≠ not equals'},{value:'contains',label:'⊃ contains'}];
  }
}
