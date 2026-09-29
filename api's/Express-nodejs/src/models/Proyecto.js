'use strict';

const { ApiError } = require('../utils/errores');
const { aIso, textoObligatorio, textoOpcional, redondear } = require('../utils/validacion');
const { crearCategoria, CATEGORIAS } = require('./Categorias');

const EstadoProyecto = Object.freeze({
  ABIERTO: 'ABIERTO',
  EN_PROGRESO: 'EN_PROGRESO',
  ENTREGADO: 'ENTREGADO',
  CANCELADO: 'CANCELADO',
});

/**
 * Clase: Proyecto (diagrama, punto 7)
 * -idProyecto: int, -nombreProyecto: String, -descripcion: String,
 * -fechaInicio: Date, -estado: String
 * +consultarProgreso()
 * Relaciones: Cliente -> Proyecto (1 a N), Proyecto -> Asignacion (1 a N),
 * Categorías -> Proyecto (1 a N). Las asignaciones las crea la API de Python.
 */
class Proyecto {
  constructor({
    idProyecto = null,
    nombreProyecto,
    descripcion = null,
    fechaInicio = null,
    estado = EstadoProyecto.ABIERTO,
    clienteId = null,
    presupuestoEstimado = null,
    categoria = null,
    asignaciones = [],
  } = {}) {
    this.idProyecto = idProyecto;
    this.nombreProyecto = nombreProyecto;
    this.descripcion = descripcion;
    this.fechaInicio = aIso(fechaInicio) || new Date().toISOString();
    this.estado = estado;
    this.clienteId = clienteId; // Cliente crea/administra (1 a N)
    this.presupuestoEstimado = presupuestoEstimado != null ? Number(presupuestoEstimado) : null;
    this.categoria = categoria; // instancia de una de las 5 categorías (1 a N)
    this.asignaciones = asignaciones; // 1 a N
  }

  /** Fábrica usada por Cliente.crearProyecto() */
  static crearDesdeCliente(cliente, datos) {
    textoObligatorio(datos, 'nombreProyecto');
    const tipoCategoria = textoOpcional(datos.tipoCategoria);
    if (!tipoCategoria || !CATEGORIAS[tipoCategoria]) {
      throw ApiError.badRequest(
        `tipoCategoria es obligatorio y debe ser uno de: ${Object.keys(CATEGORIAS).join(', ')}`
      );
    }
    const atributos = datos.categoria || {};
    const categoria = crearCategoria(tipoCategoria, atributos);
    const { valido, errores } = categoria.validar();
    if (!valido) {
      throw ApiError.badRequest(
        `La categoría ${tipoCategoria} está incompleta`,
        errores
      );
    }
    return new Proyecto({
      nombreProyecto: String(datos.nombreProyecto).trim(),
      descripcion: textoOpcional(datos.descripcion),
      fechaInicio: datos.fechaInicio,
      presupuestoEstimado: datos.presupuestoEstimado,
      clienteId: cliente.idUsuario,
      categoria,
    });
  }

  /** +consultarProgreso() : porcentaje de horas facturadas/congeladas.
   *  Las asignaciones las aporta la capa de datos (API de Python / base de
   *  datos común), no se crean desde aquí. */
  consultarProgreso(asignaciones = []) {
    const propias = asignaciones.filter((a) => a.proyectoId === this.idProyecto);
    const totalHoras = redondear(
      propias.reduce((acc, a) => acc + a.horasTotales, 0),
      2
    );
    const horasCompletadas = redondear(
      propias
        .filter((a) => a.estadoTiempo === 'CONGELADO' || a.estadoTiempo === 'APROBADO')
        .reduce((acc, a) => acc + a.horasTotales, 0),
      2
    );
    const valorFacturado = redondear(
      propias.reduce((acc, a) => acc + a.calcularValorTarea(), 0),
      2
    );
    const porcentaje = totalHoras > 0 ? redondear((horasCompletadas / totalHoras) * 100, 1) : 0;
    return {
      idProyecto: this.idProyecto,
      nombreProyecto: this.nombreProyecto,
      estado: this.estado,
      tipoCategoria: this.categoria ? this.categoria.tipo : null,
      totalAsignaciones: propias.length,
      totalHoras,
      horasCompletadas,
      valorFacturado,
      presupuestoEstimado: this.presupuestoEstimado,
      porcentajeAvance: porcentaje,
      asignaciones: propias.map((a) => ({
        idAsignacion: a.idAsignacion,
        rolEnProyecto: a.rolEnProyecto,
        usuarioId: a.usuarioId,
        estadoTiempo: a.estadoTiempo,
        horasTotales: a.horasTotales,
        valorTarea: a.calcularValorTarea(),
      })),
    };
  }

  toJSON() {
    return {
      idProyecto: this.idProyecto,
      nombreProyecto: this.nombreProyecto,
      descripcion: this.descripcion,
      fechaInicio: this.fechaInicio,
      estado: this.estado,
      clienteId: this.clienteId,
      presupuestoEstimado: this.presupuestoEstimado,
      categoria: this.categoria ? this.categoria.toJSON() : null,
      asignaciones: this.asignaciones,
    };
  }
}

module.exports = { Proyecto, EstadoProyecto };
