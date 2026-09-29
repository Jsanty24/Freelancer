'use strict';

const { Usuario, TipoUsuario } = require('./Usuario');
const { ApiError } = require('../utils/errores');
const { textoObligatorio, textoOpcional } = require('../utils/validacion');

/**
 * Clase: Trabajador (diagrama, punto 1 -> TrabajadorAtributos)
 * -especialidad: String, -disponibilidad: boolean
 * +postularAProyecto(), +consultarHistorialTrabajos()
 */
class Trabajador extends Usuario {
  constructor(datos = {}) {
    super({ ...datos, tipo: TipoUsuario.TRABAJADOR });
    this.especialidad = textoOpcional(datos.especialidad);
    this.disponibilidad = datos.disponibilidad !== false;
    this.tarifaPorHoraDefecto = datos.tarifaPorHoraDefecto != null ? Number(datos.tarifaPorHoraDefecto) : null;
    // Postulaciones: proyectos a los que se haCarteado (relación Trabajador -> Proyecto, N a N)
    this.postulaciones = [];
  }

  /** +postularAProyecto() : void */
  postularAProyecto(proyecto) {
    if (!proyecto) throw ApiError.badRequest('El proyecto es obligatorio');
    if (!this.disponibilidad) {
      throw ApiError.conflicto('El trabajador no está disponible');
    }
    if (this.postulaciones.some((p) => p.idProyecto === proyecto.idProyecto)) {
      throw ApiError.conflicto('El trabajador ya se postuló a este proyecto');
    }
    this.postulaciones.push({
      idProyecto: proyecto.idProyecto,
      fechaPostulacion: new Date().toISOString(),
      estado: 'POSTULADO',
    });
    return this.postulaciones;
  }

  retirarPostulacion(idProyecto) {
    const antes = this.postulaciones.length;
    this.postulaciones = this.postulaciones.filter((p) => p.idProyecto !== idProyecto);
    return antes !== this.postulaciones.length;
  }

  /** +consultarHistorialTrabajos() : asignaciones en las que estuvo asignado. */
  consultarHistorialTrabajos(asignaciones = []) {
    return asignaciones
      .filter((a) => a.usuarioId === this.idUsuario)
      .map((a) => ({
        idAsignacion: a.idAsignacion,
        proyectoId: a.proyectoId,
        rolEnProyecto: a.rolEnProyecto,
        estadoTiempo: a.estadoTiempo,
        horasRegistradas: a.horasRegistradas,
        valorTarea: a.calcularValorTarea(),
        fechaInicio: a.fechaInicio,
        fechaFin: a.fechaFin,
      }))
      .sort((x, y) => String(x.fechaInicio).localeCompare(String(y.fechaInicio)));
  }

  cambiarDisponibilidad(disponibilidad) {
    this.disponibilidad = Boolean(disponibilidad);
    return this;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      especialidad: this.especialidad,
      disponibilidad: this.disponibilidad,
      tarifaPorHoraDefecto: this.tarifaPorHoraDefecto,
      postulaciones: this.postulaciones,
    };
  }

  /** Payload esperado en POST /api/trabajadores. */
  static desdePayload(datos) {
    textoObligatorio(datos, 'nombre');
    return new Trabajador({
      ...datos,
      especialidad: textoObligatorio(datos, 'especialidad'),
    });
  }
}

module.exports = { Trabajador };
