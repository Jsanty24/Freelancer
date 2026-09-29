'use strict';

const express = require('express');

const { db } = require('./database');
const { asyncHandler, ok } = require('./routes/_helpers');
const { noEncontrado, manejadorErrores } = require('./middleware/errores');
const rutasUsuarios = require('./routes/usuarios');
const rutasProyectos = require('./routes/proyectos');

function crearApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // CORS simple para poder consumir la API desde el frontend
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });

  // Health check
  app.get('/', (req, res) =>
    ok(res, {
      nombre: 'API Freelancer (Node.js + Express)',
      diagrama: 'Usuario, Cliente, Trabajador, Proyecto, Asignacion, Factura, EstadoTiempo',
      documentacion: 'README.md',
    })
  );

  app.get(
    '/api/health',
    asyncHandler((req, res) => ok(res, { estado: 'ok', ...db.estadisticas() }))
  );

  app.use('/api', rutasUsuarios);
  app.use('/api', rutasProyectos);

  app.use(noEncontrado);
  app.use(manejadorErrores);

  return app;
}

module.exports = { crearApp };
