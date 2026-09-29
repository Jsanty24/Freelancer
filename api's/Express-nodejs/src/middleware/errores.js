'use strict';

const { ApiError } = require('../utils/errores');

/** 404 para rutas no registradas. */
function noEncontrado(req, res, next) {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

/** Manejador central de errores: responde siempre en JSON. */
// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.estado).json({
      error: { mensaje: err.message, detalles: err.detalles },
    });
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: { mensaje: 'JSON inválido en el cuerpo de la petición' } });
  }
  console.error('[error]', err);
  return res.status(500).json({ error: { mensaje: 'Error interno del servidor' } });
}

/** Envuelve handlers async para que los rechazos lleguen a Express 5. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { noEncontrado, manejadorErrores, asyncHandler };
