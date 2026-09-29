'use strict';

class ApiError extends Error {
  constructor(estado, mensaje, detalles = null) {
    super(mensaje);
    this.name = 'ApiError';
    this.estado = estado;
    this.detalles = detalles;
  }

  static badRequest(mensaje, detalles) {
    return new ApiError(400, mensaje, detalles);
  }

  static unauthorized(mensaje = 'Credenciales inválidas') {
    return new ApiError(401, mensaje);
  }

  static notFound(mensaje = 'Recurso no encontrado') {
    return new ApiError(404, mensaje);
  }

  static conflicto(mensaje) {
    return new ApiError(409, mensaje);
  }
}

module.exports = { ApiError };
