/**
 * Prueba de humo de la parte de Node.js: usuarios, trabajadores, clientes,
 * proyectos y postulaciones.
 *
 * Las asignaciones, horas y facturas las comprueba la API de Python
 * (pruebas/smoke.py). Aquí se referencian usuarios y proyectos por id.
 *
 * Ejecutar:  node pruebas/smoke.js
 */

'use strict';

const { crearApp } = require('../src/app');
const { db } = require('../src/database');

let total = 0;
let fallos = 0;

function check(nombre, condicion, detalle) {
  total += 1;
  if (condicion) {
    console.log(`  OK   ${nombre}`);
  } else {
    fallos += 1;
    console.log(`  FALLA ${nombre} ${JSON.stringify(detalle)}`);
  }
}

async function main() {
  db.limpiar();
  const app = crearApp();

  const servidor = app.listen(0);
  await new Promise((resolver) => servidor.once('listening', resolver));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  total += 1;

  const call = async (metodo, ruta, body) => {
    const conCuerpo = !['GET', 'HEAD'].includes(metodo.toUpperCase());
    const respuesta = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: conCuerpo ? { 'Content-Type': 'application/json' } : undefined,
      body: conCuerpo
        ? typeof body === 'string'
          ? body
          : JSON.stringify(body || {})
        : undefined,
    });
    const texto = await respuesta.text();
    let datos = {};
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = { texto };
    }
    return { status: respuesta.status, ...datos };
  };

  try {
    await correr(call);
  } finally {
    servidor.close();
  }

  console.log(`\nResultado: ${total - fallos}/${total} verificaciones OK`);
  process.exit(fallos === 0 ? 0 : 1);
}

async function correr(call) {

  console.log('\n1. Usuario.registrarse()');
  const cliente = await call('POST', '/api/clientes/registrarse', {
    nombre: 'Empresa X',
    email: 'empresa@x.com',
    telefono: '3000000001',
    password: 'clave123',
    razonSocial: 'Empresa X S.A.',
    direccionFacturacion: 'Carrera 1 # 2-3',
  });
  check('cliente creado (201)', cliente.status === 201);
  const idCliente = cliente.data.idUsuario;

  const trabajador = await call('POST', '/api/trabajadores/registrarse', {
    nombre: 'Dev Uno',
    email: 'dev@uno.com',
    telefono: '3000000002',
    password: 'clave123',
    especialidad: 'Node.js',
  });
  check('trabajador creado (201)', trabajador.status === 201);
  const idTrabajador = trabajador.data.idUsuario;

  const tipoMalo = await call('POST', '/api/usuarios/registrarse', {
    tipo: 'ADMIN',
    nombre: 'X',
    email: 'x@x.com',
    telefono: '3000000009',
    password: 'clave123',
  });
  check('tipo inválido rechazado (400)', tipoMalo.status === 400);

  const emailDup = await call('POST', '/api/trabajadores/registrarse', {
    nombre: 'Otro',
    email: 'dev@uno.com',
    telefono: '3000000003',
    password: 'clave123',
    especialidad: 'PHP',
  });
  check('email duplicado (409)', emailDup.status === 409);

  console.log('\n2. Usuario.iniciarSesion()');
  const login = await call('POST', '/api/usuarios/login', {
    email: 'dev@uno.com',
    password: 'clave123',
  });
  check('login correcto (200)', login.status === 200 && login.data.token);
  const loginMal = await call('POST', '/api/usuarios/login', {
    email: 'dev@uno.com',
    password: 'mala',
  });
  check('login inválido (401)', loginMal.status === 401);

  console.log('\n3. Usuario.actualizarDatos()');
  const actualizado = await call('PUT', `/api/usuarios/${idCliente}`, {
    telefono: '3009999999',
  });
  check(
    'teléfono actualizado',
    actualizado.status === 200 && actualizado.data.telefono === '3009999999'
  );

  console.log('\n4. Cliente.crearProyecto()');
  const proyecto = await call('POST', `/api/clientes/${idCliente}/proyectos`, {
    nombreProyecto: 'App móvil',
    descripcion: 'Aplicación para clientes',
    presupuestoEstimado: 1500,
    tipoCategoria: 'TECNOLOGIA_Y_PROGRAMACION',
    categoria: { lenguajePrincipal: 'JavaScript', repositorioUrl: 'https://git/app' },
  });
  check('proyecto creado (201)', proyecto.status === 201);
  const idProyecto = proyecto.data.idProyecto;

  const proyectoMalo = await call('POST', `/api/clientes/${idCliente}/proyectos`, {
    nombreProyecto: 'Sin categoría',
  });
  check('proyecto sin categoría rechazado (400)', proyectoMalo.status === 400);

  const delCliente = await call('GET', `/api/clientes/${idCliente}/proyectos`);
  check('proyectos del cliente', delCliente.status === 200 && delCliente.data.length === 1);

  console.log('\n5. Listado y filtros de proyectos');
  const proyectos = await call('GET', '/api/proyectos');
  check('proyectos listados', proyectos.status === 200 && proyectos.data.length === 1);
  const porCliente = await call('GET', `/api/proyectos?clienteId=${idCliente}`);
  check('filtro por cliente', porCliente.data.length === 1);
  const porCategoria = await call('GET', '/api/proyectos?tipoCategoria=REDACCION_Y_CONTENIDO');
  check('filtro por categoría sin resultados', porCategoria.data.length === 0);
  const categorias = await call('GET', '/api/categorias');
  check('5 categorías del diagrama', categorias.data.length === 5);

  const progreso = await call('GET', `/api/proyectos/${idProyecto}/progreso`);
  check(
    'progreso sin asignaciones (0%)',
    progreso.status === 200 && progreso.data.totalAsignaciones === 0
  );

  console.log('\n6. Trabajador.postularAProyecto()');
  const postulacion = await call('POST', `/api/trabajadores/${idTrabajador}/postular`, {
    proyectoId: idProyecto,
  });
  check('postulación registrada (201)', postulacion.status === 201);
  const repetida = await call('POST', `/api/trabajadores/${idTrabajador}/postular`, {
    proyectoId: idProyecto,
  });
  check('postulación duplicada rechazada (409)', repetida.status === 409);

  const propia = await call('POST', `/api/trabajadores/${idCliente}/postular`, {
    proyectoId: idProyecto,
  });
  check('cliente no puede postular a su proyecto (404)', propia.status === 404);

  console.log('\n7. Trabajador.cambiarDisponibilidad() e historial');
  const disponible = await call(
    'PUT',
    `/api/trabajadores/${idTrabajador}/disponibilidad`,
    { disponibilidad: false }
  );
  check(
    'disponibilidad actualizada',
    disponible.status === 200 && disponible.data.disponibilidad === false
  );
  const filtrados = await call('GET', '/api/trabajadores?disponibilidad=false');
  check('filtro por disponibilidad', filtrados.data.length === 1);
  const porEspecialidad = await call('GET', '/api/trabajadores?especialidad=node');
  check('filtro por especialidad', porEspecialidad.data.length === 1);

  const historial = await call('GET', `/api/trabajadores/${idTrabajador}/historial`);
  check(
    'historial sin asignaciones (las tiene Python)',
    historial.status === 200 && historial.data.historial.length === 0
  );

  console.log('\n8. Errores generales');
  const noExiste = await call('GET', '/api/proyectos/9999');
  check('proyecto inexistente (404)', noExiste.status === 404);
  const rutaMala = await call('GET', '/api/no-existe');
  check('ruta inexistente (404)', rutaMala.status === 404);
  const cuerpoMalo = await call('POST', '/api/clientes/1/proyectos', 'no soy json');
  check('cuerpo no JSON (400)', cuerpoMalo.status === 400);

  const salud = await call('GET', '/api/health');
  check(
    'health con los conteos de Node',
    salud.status === 200 && salud.data.usuarios === 2 && salud.data.proyectos === 1,
    salud
  );
  check('health no expone datos de Python', salud.data.facturas === undefined, salud.data);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
