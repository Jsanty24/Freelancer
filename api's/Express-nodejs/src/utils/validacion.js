'use strict';

const { ApiError } = require('./errores');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esObjeto = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const esVacio = (v) => v === undefined || v === null || String(v).trim() === '';

const textoOpcional = (v) => (esVacio(v) ? null : String(v).trim());

function textoObligatorio(objeto, campo) {
  if (!objeto || esVacio(objeto[campo])) {
    throw ApiError.badRequest(`El campo "${campo}" es obligatorio`);
  }
  return String(objeto[campo]).trim();
}

const emailValido = (v) => typeof v === 'string' && EMAIL_RE.test(v.trim());

const esNumeroPositivo = (v) => Number.isFinite(Number(v)) && Number(v) > 0;

function aIso(valor) {
  if (esVacio(valor)) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

const redondear = (v, d = 2) => {
  const f = 10 ** d;
  return Math.round((Number(v) + Number.EPSILON) * f) / f;
};

/** Convierte "?a=1&b=2" o un query de Express en un objeto plano. */
function queryAPlaino(query = {}) {
  return Object.fromEntries(
    Object.entries(query).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])
  );
}

module.exports = {
  ApiError,
  esObjeto,
  esVacio,
  textoOpcional,
  textoObligatorio,
  emailValido,
  esNumeroPositivo,
  aIso,
  redondear,
  queryAPlaino,
};
