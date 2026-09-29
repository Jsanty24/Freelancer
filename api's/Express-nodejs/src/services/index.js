'use strict';

/**
 * Servicios: contienen la lógica de negocio que coordina a varias clases
 * del diagrama. Las rutas solo validan entrada y delegan aquí.
 *
 * Node.js gestiona Usuario, Trabajador, Cliente, Proyecto y Postulacion.
 * Asignacion, horas, temporizador y Factura los gestiona la API de Python.
 */
const { db } = require('../database');
const { ApiError } = require('../utils/errores');
const servicioUsuarios = {
  registrar(tipo, datos) {
    const { Cliente } = require('../models/Cliente');
    const { Trabajador } = require('../models/Trabajador');
    const clases = { CLIENTE: Cliente, TRABAJADOR: Trabajador };
    const Clase = clases[String(tipo).toUpperCase()];
    if (!Clase) {
      throw ApiError.badRequest(
        `tipo debe ser CLIENTE o TRABAJADOR (recibido: ${tipo})`
      );
    }
    return db.crearUsuario(Clase, datos);
  },

  listar() {
    return db.usuarios;
  },

  obtener(id) {
    return db.obtenerUsuario(id);
  },

  iniciarSesion(email, password) {
    const usuario = db.buscarUsuarioPorEmail(email);
    if (!usuario) throw ApiError.unauthorized('Credenciales inválidas');
    return usuario.iniciarSesion(password);
  },

  actualizar(id, cambios) {
    return db.obtenerUsuario(id).actualizarDatos(cambios);
  },
};

const servicioTrabajadores = {
  listar(filtro = {}) {
    let resultado = db.trabajadores;
    if (filtro.especialidad) {
      const esp = String(filtro.especialidad).toLowerCase();
      resultado = resultado.filter(
        (t) => String(t.especialidad).toLowerCase().includes(esp)
      );
    }
    if (filtro.disponibilidad !== undefined) {
      const disponible = filtro.disponibilidad === true || filtro.disponibilidad === 'true';
      resultado = resultado.filter((t) => t.disponibilidad === disponible);
    }
    return resultado;
  },

  obtener(id) {
    return db.obtenerTrabajador(id);
  },

  /** +postularAProyecto() */
  postular(id, idProyecto) {
    const trabajador = db.obtenerTrabajador(id);
    const proyecto = db.obtenerProyecto(idProyecto);
    if (proyecto.clienteId === trabajador.idUsuario) {
      throw ApiError.conflicto('Un cliente no puede postular a su propio proyecto');
    }
    trabajador.postularAProyecto(proyecto);
    return { trabajador, proyecto };
  },

  cambiarDisponibilidad(id, disponibilidad) {
    return db.obtenerTrabajador(id).cambiarDisponibilidad(disponibilidad);
  },

  /**
   * +consultarHistorialTrabajos()
   *
   * Las asignaciones son de la API de Python: con la base de datos MySQL se
   * leerán de su tabla, así que aquí todavía no hay ninguna.
   */
  historial(id) {
    const trabajador = db.obtenerTrabajador(id);
    return {
      trabajador: trabajador.toJSON(),
      historial: trabajador.consultarHistorialTrabajos([]),
    };
  },
};

const servicioClientes = {
  listar() {
    return db.clientes;
  },

  obtener(id) {
    return db.obtenerCliente(id);
  },

  /** +crearProyecto() */
  crearProyecto(idCliente, datos) {
    return db.crearProyecto(db.obtenerCliente(idCliente), datos);
  },

  proyectos(idCliente) {
    db.obtenerCliente(idCliente);
    return db.obtenerProyectosPorCliente(idCliente);
  },
};

const servicioProyectos = {
  listar(filtro = {}) {
    let resultado = db.proyectos;
    if (filtro.clienteId) {
      resultado = resultado.filter((p) => p.clienteId === Number(filtro.clienteId));
    }
    if (filtro.estado) {
      resultado = resultado.filter((p) => p.estado === filtro.estado);
    }
    if (filtro.tipoCategoria) {
      resultado = resultado.filter((p) => p.categoria && p.categoria.tipo === filtro.tipoCategoria);
    }
    return resultado;
  },

  obtener(id) {
    return db.obtenerProyecto(id);
  },

  /**
   * +consultarProgreso()
   *
   * Las asignaciones son de la API de Python: con la base de datos MySQL se
   * leerán de su tabla, así que aquí todavía no hay ninguna.
   */
  progreso(idProyecto) {
    const proyecto = db.obtenerProyecto(idProyecto);
    return proyecto.consultarProgreso([]);
  },
};

module.exports = {
  servicioUsuarios,
  servicioTrabajadores,
  servicioClientes,
  servicioProyectos,
};
