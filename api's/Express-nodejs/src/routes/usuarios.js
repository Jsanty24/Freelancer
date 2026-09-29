'use strict';

/**
 * Rutas de Node.js: personas y proyectos.
 *
 * Esta API es la Proprietaria de Usuario, Trabajador, Cliente, Proyecto y
 * Postulacion. Lo que tiene que ver con Asignacion, horas, temporizador y
 * Factura lo expone la API de Python (puerto 5000).
 */

const express = require('express');
const {
  servicioUsuarios,
  servicioTrabajadores,
  servicioClientes,
} = require('../services');
const { asyncHandler, ok, cuerpo, queryAPlaino } = require('./_helpers');
const { textoObligatorio } = require('../utils/validacion');

const router = express.Router();

/* --------------------------------- Usuarios -------------------------------- */

// POST /api/usuarios/registrarse  ->  +registrarse()
router.post(
  '/usuarios/registrarse',
  asyncHandler((req, res) => {
    const body = cuerpo(req);
    const tipo = textoObligatorio(body, 'tipo').toUpperCase();
    const usuario = servicioUsuarios.registrar(tipo, body);
    return ok(res, usuario, 201, `Usuario (${tipo}) registrado correctamente`);
  })
);

// GET /api/usuarios
router.get(
  '/usuarios',
  asyncHandler((req, res) => ok(res, servicioUsuarios.listar()))
);

// GET /api/usuarios/:id
router.get(
  '/usuarios/:id',
  asyncHandler((req, res) => ok(res, servicioUsuarios.obtener(req.params.id)))
);

// POST /api/usuarios/login  ->  +iniciarSesion()
router.post(
  '/usuarios/login',
  asyncHandler((req, res) => {
    const body = cuerpo(req);
    const resultado = servicioUsuarios.iniciarSesion(
      textoObligatorio(body, 'email'),
      textoObligatorio(body, 'password')
    );
    return ok(res, resultado, 200, 'Sesión iniciada');
  })
);

// PUT /api/usuarios/:id  ->  +actualizarDatos()
router.put(
  '/usuarios/:id',
  asyncHandler((req, res) =>
    ok(res, servicioUsuarios.actualizar(req.params.id, cuerpo(req)), 200, 'Datos actualizados')
  )
);

/* ------------------------------- Trabajadores ------------------------------- */

// POST /api/trabajadores/registrarse
router.post(
  '/trabajadores/registrarse',
  asyncHandler((req, res) =>
    ok(res, servicioUsuarios.registrar('TRABAJADOR', cuerpo(req)), 201, 'Trabajador registrado')
  )
);

// GET /api/trabajadores?especialidad=&disponibilidad=
router.get(
  '/trabajadores',
  asyncHandler((req, res) => ok(res, servicioTrabajadores.listar(queryAPlaino(req.query))))
);

// GET /api/trabajadores/:id
router.get(
  '/trabajadores/:id',
  asyncHandler((req, res) => ok(res, servicioTrabajadores.obtener(req.params.id)))
);

// POST /api/trabajadores/:id/postular  ->  +postularAProyecto()
router.post(
  '/trabajadores/:id/postular',
  asyncHandler((req, res) => {
    const body = cuerpo(req);
    const { trabajador } = servicioTrabajadores.postular(
      req.params.id,
      textoObligatorio(body, 'proyectoId')
    );
    return ok(res, trabajador, 201, 'Postulación registrada');
  })
);

// GET /api/trabajadores/:id/historial  ->  +consultarHistorialTrabajos()
router.get(
  '/trabajadores/:id/historial',
  asyncHandler((req, res) => ok(res, servicioTrabajadores.historial(req.params.id)))
);

// PUT /api/trabajadores/:id/disponibilidad
router.put(
  '/trabajadores/:id/disponibilidad',
  asyncHandler((req, res) => {
    const body = cuerpo(req);
    const trabajador = servicioTrabajadores.cambiarDisponibilidad(
      req.params.id,
      body.disponibilidad
    );
    return ok(res, trabajador, 200, 'Disponibilidad actualizada');
  })
);

/* ---------------------------------- Clientes -------------------------------- */

// POST /api/clientes/registrarse
router.post(
  '/clientes/registrarse',
  asyncHandler((req, res) =>
    ok(res, servicioUsuarios.registrar('CLIENTE', cuerpo(req)), 201, 'Cliente registrado')
  )
);

// GET /api/clientes
router.get('/clientes', asyncHandler((req, res) => ok(res, servicioClientes.listar())));

// GET /api/clientes/:id
router.get(
  '/clientes/:id',
  asyncHandler((req, res) => ok(res, servicioClientes.obtener(req.params.id)))
);

// POST /api/clientes/:id/proyectos  ->  +crearProyecto()
router.post(
  '/clientes/:id/proyectos',
  asyncHandler((req, res) => {
    const proyecto = servicioClientes.crearProyecto(req.params.id, cuerpo(req));
    return ok(res, proyecto, 201, 'Proyecto creado');
  })
);

// GET /api/clientes/:id/proyectos
router.get(
  '/clientes/:id/proyectos',
  asyncHandler((req, res) => ok(res, servicioClientes.proyectos(req.params.id)))
);

module.exports = router;
