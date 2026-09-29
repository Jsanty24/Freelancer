'use strict';

/**
 * Rutas de Node.js: proyectos y categorías.
 *
 * Solo lectura y gestión de proyectos. Las asignaciones de trabajadores a
 * proyectos las crea y consulta la API de Python (puerto 5000), que es la
 * propietaria de esa entidad.
 */

const express = require('express');
const { servicioProyectos } = require('../services');
const { asyncHandler, ok, queryAPlaino } = require('./_helpers');
const { CATEGORIAS } = require('../models/Categorias');

const router = express.Router();

/* --------------------------------- Categorías -------------------------------- */

// GET /api/categorias -> las 5 clases de tipo del diagrama
router.get('/categorias', (req, res) =>
  ok(res, Object.keys(CATEGORIAS).map((tipo) => ({ tipo, campos: CATEGORIAS[tipo].name })))
);

/* --------------------------------- Proyectos -------------------------------- */

// GET /api/proyectos?clienteId=&estado=&tipoCategoria=
router.get(
  '/proyectos',
  asyncHandler((req, res) => ok(res, servicioProyectos.listar(queryAPlaino(req.query))))
);

// GET /api/proyectos/:id
router.get(
  '/proyectos/:id',
  asyncHandler((req, res) => ok(res, servicioProyectos.obtener(req.params.id)))
);

// GET /api/proyectos/:id/progreso  ->  +consultarProgreso()
router.get(
  '/proyectos/:id/progreso',
  asyncHandler((req, res) => ok(res, servicioProyectos.progreso(req.params.id)))
);

module.exports = router;
