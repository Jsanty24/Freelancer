'use strict';

const { Usuario, TipoUsuario } = require('./Usuario');
const { ApiError } = require('../utils/errores');
const { textoObligatorio, textoOpcional } = require('../utils/validacion');

/**
 * Clase: Cliente (diagrama, punto 2)
 * -razonSocial: String, -direccionFacturacion: String
 * +crearProyecto()
 *
 * La aprobación y el rechazo de facturas los hace la API de Python.
 */
class Cliente extends Usuario {
  constructor(datos = {}) {
    super({ ...datos, tipo: TipoUsuario.CLIENTE });
    this.razonSocial = textoOpcional(datos.razonSocial);
    this.direccionFacturacion = textoOpcional(datos.direccionFacturacion);
    // Relaciones: Cliente -> Proyecto (1 a N) y Cliente -> Factura (1 a N)
    this.proyectosCreados = [];
    this.facturasEmitidas = [];
  }

  /** +crearProyecto() : void -> devuelve la instancia de Proyecto creada. */
  crearProyecto(datos, claseProyecto = require('./Proyecto').Proyecto) {
    if (!this.razonSocial) {
      throw ApiError.badRequest('El cliente debe tener razón social registrada');
    }
    if (!datos || typeof datos !== 'object') {
      throw ApiError.badRequest('Los datos del proyecto son obligatorios');
    }
    const proyecto = claseProyecto.crearDesdeCliente(this, datos);
    this.proyectosCreados.push(proyecto.idProyecto);
    return proyecto;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      razonSocial: this.razonSocial,
      direccionFacturacion: this.direccionFacturacion,
      proyectosCreados: this.proyectosCreados,
      facturasEmitidas: this.facturasEmitidas,
    };
  }

  static desdePayload(datos) {
    textoObligatorio(datos, 'nombre');
    return new Cliente({
      ...datos,
      razonSocial: textoObligatorio(datos, 'razonSocial'),
      direccionFacturacion: textoObligatorio(datos, 'direccionFacturacion'),
    });
  }
}

module.exports = { Cliente };
