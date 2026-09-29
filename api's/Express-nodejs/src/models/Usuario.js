'use strict';

const crypto = require('crypto');
const { ApiError } = require('../utils/errores');
const { emailValido, aIso } = require('../utils/validacion');

const TipoUsuario = Object.freeze({
  CLIENTE: 'CLIENTE',
  TRABAJADOR: 'TRABAJADOR',
  ADMIN: 'ADMIN',
});

function hashearPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verificarPassword(password, almacenado) {
  if (!almacenado || !almacenado.includes(':')) return false;
  const [salt, hash] = almacenado.split(':');
  const calculado = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calculado, 'hex'));
}

/**
 * Clase: Usuario (diagrama, punto 3)
 * -idUsuario: int, -nombre: String, -email: String, -telefono: String
 * +registrarse(), +iniciarSesion(), +actualizarDatos()
 */
class Usuario {
  constructor({
    idUsuario = null,
    nombre,
    email,
    telefono = null,
    password = null,
    tipo = TipoUsuario.ADMIN,
    activo = true,
    fechaRegistro = null,
  } = {}) {
    this.idUsuario = idUsuario;
    this.nombre = nombre != null ? String(nombre).trim() : null;
    this.email = email != null ? String(email).trim().toLowerCase() : null;
    this.telefono = telefono != null ? String(telefono).trim() : null;
    this.password = password ? hashearPassword(password) : null;
    this.tipo = tipo;
    this.activo = Boolean(activo);
    this.fechaRegistro = aIso(fechaRegistro) || new Date().toISOString();
  }

  /** +registrarse() : valida los datos de alta. */
  registrarse() {
    const errores = [];
    if (!this.nombre) errores.push('nombre es obligatorio');
    if (!emailValido(this.email)) errores.push('email no tiene un formato válido');
    if (this.telefono && this.telefono.length < 6) {
      errores.push('telefono debe tener al menos 6 caracteres');
    }
    if (!this.password) errores.push('password es obligatorio');
    if (errores.length) {
      throw ApiError.badRequest('No se puede registrar el usuario', errores);
    }
    this.fechaRegistro = new Date().toISOString();
    return this;
  }

  /** +iniciarSesion() : devuelve un token simple si el password coincide. */
  iniciarSesion(password) {
    if (!this.activo) throw ApiError.unauthorized('El usuario está inactivo');
    if (!verificarPassword(password, this.password)) {
      throw ApiError.unauthorized('Credenciales inválidas');
    }
    return {
      token: this.generarToken(),
      usuario: this.toJSON(),
    };
  }

  /** +actualizarDatos() : actualiza nombre/telefono/email de forma parcial. */
  actualizarDatos(cambios = {}) {
    if (cambios.nombre !== undefined) {
      if (!cambios.nombre || !String(cambios.nombre).trim()) {
        throw ApiError.badRequest('nombre no puede estar vacío');
      }
      this.nombre = String(cambios.nombre).trim();
    }
    if (cambios.email !== undefined) {
      if (!emailValido(cambios.email)) {
        throw ApiError.badRequest('email no tiene un formato válido');
      }
      this.email = String(cambios.email).trim().toLowerCase();
    }
    if (cambios.telefono !== undefined) {
      this.telefono = cambios.telefono ? String(cambios.telefono).trim() : null;
    }
    if (cambios.password !== undefined) {
      if (!cambios.password) throw ApiError.badRequest('password no puede estar vacío');
      this.password = hashearPassword(cambios.password);
    }
    if (cambios.activo !== undefined) this.activo = Boolean(cambios.activo);
    this.actualizadoEn = new Date().toISOString();
    return this;
  }

  generarToken() {
    const payload = `${this.idUsuario}.${Date.now()}.${crypto.randomBytes(8).toString('hex')}`;
    return Buffer.from(`${payload}.${this.calcularFirma(payload)}`).toString('base64url');
  }

  calcularFirma(payload) {
    return crypto.createHash('sha256').update(`${payload}:${this.email}`).digest('hex');
  }

  /** Verifica un token emitido por generarToken(). */
  validarToken(token) {
    if (!token) return false;
    try {
      const [payload, firma] = Buffer.from(token, 'base64url').toString('utf8').split('.');
      return crypto.timingSafeEqual(
        Buffer.from(this.calcularFirma(payload), 'hex'),
        Buffer.from(firma, 'hex')
      );
    } catch {
      return false;
    }
  }

  toJSON() {
    return {
      idUsuario: this.idUsuario,
      nombre: this.nombre,
      email: this.email,
      telefono: this.telefono,
      tipo: this.tipo,
      activo: this.activo,
      fechaRegistro: this.fechaRegistro,
    };
  }
}

module.exports = { Usuario, TipoUsuario, hashearPassword, verificarPassword };
