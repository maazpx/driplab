'use strict';
const { E } = require('./errors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(input, schema, { partial = false } = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw E.invalid('O corpo da requisição deve ser um objeto JSON');
  }
  const out = {};
  const errors = {};
  for (const [key, rule] of Object.entries(schema)) {
    let v = input[key];
    if (v === undefined) {
      if (partial) continue;
      if (rule.required) { errors[key] = 'campo obrigatório'; continue; }
      if ('default' in rule) out[key] = rule.default;
      continue;
    }
    if (v === null) {
      if (rule.nullable) { out[key] = null; continue; }
      errors[key] = 'não pode ser nulo'; continue;
    }
    switch (rule.type) {
      case 'string':
      case 'email': {
        if (typeof v !== 'string') { errors[key] = 'deve ser texto'; break; }
        v = v.trim();
        if (rule.type === 'email') v = v.toLowerCase();
        const min = rule.min ?? (rule.required ? 1 : 0);
        if (v.length < min) { errors[key] = min <= 1 ? 'não pode ser vazio' : `mínimo de ${min} caracteres`; break; }
        if (rule.max && v.length > rule.max) { errors[key] = `máximo de ${rule.max} caracteres`; break; }
        if (rule.type === 'email' && !EMAIL_RE.test(v)) { errors[key] = 'e-mail inválido'; break; }
        if (rule.pattern && !rule.pattern.test(v)) { errors[key] = rule.patternMsg || 'formato inválido'; break; }
        out[key] = v; break;
      }
      case 'int':
      case 'number': {
        if (typeof v !== 'number' || !Number.isFinite(v) || (rule.type === 'int' && !Number.isInteger(v))) {
          errors[key] = rule.type === 'int' ? 'deve ser um número inteiro' : 'deve ser um número'; break;
        }
        if (rule.min !== undefined && v < rule.min) { errors[key] = `mínimo ${rule.min}`; break; }
        if (rule.max !== undefined && v > rule.max) { errors[key] = `máximo ${rule.max}`; break; }
        out[key] = rule.type === 'number' ? Math.round(v * 100) / 100 : v; break;
      }
      case 'bool': {
        if (typeof v === 'boolean') out[key] = v;
        else if (v === 0 || v === 1) out[key] = v === 1;
        else errors[key] = 'deve ser verdadeiro ou falso';
        break;
      }
      case 'datetime': {
        const d = typeof v === 'string' ? new Date(v) : null;
        if (!d || Number.isNaN(d.getTime())) errors[key] = 'data inválida (use ISO 8601, ex.: 2026-12-01T18:00:00Z)';
        else out[key] = d;
        break;
      }
      case 'enum': {
        if (!rule.values.includes(v)) errors[key] = `valores aceitos: ${rule.values.join(', ')}`;
        else out[key] = v;
        break;
      }
      default: throw new Error(`tipo de validação desconhecido: ${rule.type}`);
    }
  }
  if (Object.keys(errors).length) throw E.invalid('Dados inválidos', errors);
  return out;
}

function intParam(value, name = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw E.notFound(name);
  return n;
}

function queryInt(query, key, def, { min = 1, max = 1000 } = {}) {
  const raw = query.get(key);
  if (raw === null || raw === '') return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw E.badRequest(`Parâmetro "${key}" inválido (${min}–${max})`);
  return n;
}

module.exports = { validate, intParam, queryInt };
