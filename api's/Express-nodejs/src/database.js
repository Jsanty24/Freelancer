'use strict';

const { Usuario } = require('./models/Usuario');
const { Trabajador } = require('./models/Trabajador');
const { Cliente } = require('./models/Cliente');
const { Proyecto } = require('./models/Proyecto');
const { crearCategoria } = require('./models/Categorias');
const { ApiError } = require('./utils/errores');

/**
 * Capa de datos de la parte de Node.js.
 *
 * Gestiona Usuario, Trabajador, Cliente, Proyecto y las postulaciones.
 * Asignacion, horas, temporizador y Factura los lleva la API de Python, así
 * que aquí no se guardan: se referencian por id, que será la clave
 * foránea de la tabla común en MySQL (phpMyAdmin).
 *
 * Hoy es un almacén en memoria: las rutas y los servicios no cambian cuando
 * se migre a MySQL, solo se reescribe este archivo para ejecutar consultas SQL
 * con los mismos nombres de método.
 *
 * Multiplicidades del diagragma que gestiona este archivo:
 *  - Cliente 1 -> N Proyecto
 *  - Trabajador -> Postulacion -> Proyecto
 *  - Proyecto 1 -> N Asignacion (las asignaciones las crea Python)
 */
class Database {
  constructor() {
    this.usuarios = [];
    this.trabajadores = [];
    this.clientes = [];
    this.proyectos = [];
    this.contadores = { usuario: 0, proyecto: 0 };
  }

  siguienteId(tipo) {
    this.contadores[tipo] += 1;
    return this.contadores[tipo];
  }

  // ---------------------------------------------------------------- Usuarios
  crearUsuario(Clase, datos) {
    const usuario = new Clase({ ...datos, idUsuario: this.siguienteId('usuario') });
    usuario.registrarse();
    if (this.buscarUsuarioPorEmail(usuario.email)) {
      throw ApiError.conflicto('Ya existe un usuario registrado con ese email');
    }
    this.usuarios.push(usuario);
    if (usuario instanceof Trabajador) this.trabajadores.push(usuario);
    if (usuario instanceof Cliente) this.clientes.push(usuario);
    return usuario;
  }

  buscarUsuarioPorEmail(email) {
    const correo = String(email || '').toLowerCase().trim();
    return this.usuarios.find((u) => u.email === correo) || null;
  }

  obtenerUsuario(id) {
    const usuario = this.usuarios.find((u) => u.idUsuario === Number(id));
    if (!usuario) throw ApiError.notFound(`Usuario ${id} no encontrado`);
    return usuario;
  }

  obtenerTrabajador(id) {
    const trabajador = this.trabajadores.find((t) => t.idUsuario === Number(id));
    if (!trabajador) throw ApiError.notFound(`Trabajador ${id} no encontrado`);
    return trabajador;
  }

  obtenerCliente(id) {
    const cliente = this.clientes.find((c) => c.idUsuario === Number(id));
    if (!cliente) throw ApiError.notFound(`Cliente ${id} no encontrado`);
    return cliente;
  }

  // --------------------------------------------------------------- Proyectos
  crearProyecto(cliente, datos) {
    const proyecto = cliente.crearProyecto(datos);
    proyecto.idProyecto = this.siguienteId('proyecto');
    this.proyectos.push(proyecto);
    return proyecto;
  }

  obtenerProyecto(id) {
    const proyecto = this.proyectos.find((p) => p.idProyecto === Number(id));
    if (!proyecto) throw ApiError.notFound(`Proyecto ${id} no encontrado`);
    return proyecto;
  }

  obtenerProyectosPorCliente(clienteId) {
    return this.proyectos.filter((p) => p.clienteId === Number(clienteId));
  }

  obtenerProyectosPublicos() {
    return this.proyectos.filter((p) => p.estado === 'ABIERTO');
  }

  // ------------------------------------------------------------------ Datos

  /** Vacía el almacén. Se usa en pruebas. */
  limpiar() {
    this.usuarios = [];
    this.trabajadores = [];
    this.clientes = [];
    this.proyectos = [];
    this.contadores = { usuario: 0, proyecto: 0 };
    return this;
  }

  estadisticas() {
    return {
      usuarios: this.usuarios.length,
      trabajadores: this.trabajadores.length,
      clientes: this.clientes.length,
      proyectos: this.proyectos.length,
    };
  }
}

const db = new Database();
module.exports = { Database, db, Proyecto, crearCategoria };
