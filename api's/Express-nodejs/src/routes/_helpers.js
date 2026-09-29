'use strict';

const { db } = require('../database');
const { ApiError } = require('../utils/errores');
const { queryAPlaino, esObjeto } = require('../utils/validacion');

/** Envuelve un handler async y delega los errores al middleware de errores. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Envuelve la respuesta en el formato estándar de la API. */
const ok = (res, data, estado = 200, mensaje = null) =>
  res.status(estado).json({ ok: true, mensaje, data });

/** Exige un cuerpo JSON objeto. */
function cuerpo(req) {
  if (!esObjeto(req.body)) {
    throw ApiError.badRequest('El cuerpo de la petición debe ser un objeto JSON');
  }
  return req.body;
}

module.exports = { db, ApiError, asyncHandler, ok, cuerpo, queryAPlaino };
