'use strict';

const { crearApp } = require('./src/app');

const PUERTO = Number(process.env.PORT) || 3000;

const app = crearApp();

app.listen(PUERTO, () => {
  console.log(`API Freelancer escuchando en http://localhost:${PUERTO}`);
  console.log('Prueba: curl http://localhost:%d/api/health', PUERTO);
});
