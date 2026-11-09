/**
 * Suite de pruebas de integración para API 3 — Express (Asignaciones, Temporizador, Registros de Tiempo y Facturas).
 *
 * Cubre:
 * - Protección con X-Internal-Key (403) y formato único de error { status: 'error', message: '...' }
 * - Temporizador: inicio, temporizador duplicado en misma asignación (409), solapamiento en otra asignación (409) y detención
 * - Registro de horas manuales (POST /asignaciones/:id/registros-tiempo) y cálculo de valor (GET /asignaciones/:id/valor)
 * - Aprobación de registros de tiempo (PATCH /registros-tiempo/:id)
 * - Tarifa histórica: cambiar tarifa_por_hora en la asignación después de aprobar horas conserva la tarifa_aplicada histórica
 * - Factura con múltiples asignaciones (POST /facturas agrupa registros aprobados de varias asignaciones y los congela)
 * - Bloqueo de registros congelados (triggers): modificar o borrar un registro CONGELADO responde 409; borrar factura o asignación con registros congelados responde 409
 * - Rechazo de factura pendiente libera los registros congelados a estado APROBADO
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
if (!process.env.INTERNAL_API_KEY) {
    process.env.INTERNAL_API_KEY = 'clave_interna_pruebas_express_1234567890';
}

const mysql = require('mysql2/promise');
const app = require('../index');

let server;
let baseUrl;
let db;

const idsLimpieza = {
    usuarios: [],
    proyectos: [],
    asignaciones: [],
    facturas: []
};

let clienteId;
let trabajadorId;
let proyecto1Id;
let proyecto2Id;
let asignacion1Id;
let asignacion2Id;
let registroTimerId;
let registroManual1Id;
let registroManual2Id;
let facturaId;

async function peticion(method, ruta, body = undefined, incluirClave = true) {
    const headers = { Accept: 'application/json' };
    if (incluirClave) {
        headers['X-Internal-Key'] = process.env.INTERNAL_API_KEY;
    }
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }
    const respuesta = await fetch(`${baseUrl}${ruta}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const texto = await respuesta.text();
    const json = texto ? JSON.parse(texto) : null;
    return { status: respuesta.status, data: json };
}

before(async () => {
    db = await mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'plataforma_freelance',
        waitForConnections: true,
        connectionLimit: 5
    });

    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            baseUrl = `http://127.0.0.1:${addr.port}`;
            resolve();
        });
    });

    const sufijo = crypto.randomBytes(5).toString('hex');

    const [resCli] = await db.query(
        "INSERT INTO usuarios (nombre, email, telefono, password_hash, rol) VALUES (?, ?, '3000000001', '$2y$10$hashdepruebasexpress12345678901234567890', 'CLIENTE')",
        [`Cliente Express ${sufijo}`, `cliente_exp_${sufijo}@pruebas.test`]
    );
    clienteId = resCli.insertId;
    idsLimpieza.usuarios.push(clienteId);
    await db.query(
        "INSERT INTO clientes (usuario_id, razon_social, direccion_facturacion) VALUES (?, ?, 'Calle 10 # 20-30')",
        [clienteId, `Empresa ${sufijo}`]
    );

    const [resTrab] = await db.query(
        "INSERT INTO usuarios (nombre, email, telefono, password_hash, rol) VALUES (?, ?, '3000000002', '$2y$10$hashdepruebasexpress12345678901234567890', 'TRABAJADOR')",
        [`Trabajador Express ${sufijo}`, `trab_exp_${sufijo}@pruebas.test`]
    );
    trabajadorId = resTrab.insertId;
    idsLimpieza.usuarios.push(trabajadorId);
    await db.query(
        "INSERT INTO trabajadores (usuario_id, especialidad, disponibilidad) VALUES (?, 'Backend Node.js', 1)",
        [trabajadorId]
    );

    const [resProy1] = await db.query(
        "INSERT INTO proyectos (cliente_id, nombre_proyecto, descripcion, fecha_inicio, tipo, estado) VALUES (?, ?, 'Proyecto 1 para pruebas de Express', '2026-02-01', 'TECNOLOGIA', 'EN_CURSO')",
        [clienteId, `Proyecto A ${sufijo}`]
    );
    proyecto1Id = resProy1.insertId;
    idsLimpieza.proyectos.push(proyecto1Id);
    await db.query(
        "INSERT INTO proyectos_tecnologia (proyecto_id, tipo, lenguaje_principal, repositorio_url) VALUES (?, 'TECNOLOGIA', 'JavaScript', 'https://github.com/demo/proy1')",
        [proyecto1Id]
    );

    const [resProy2] = await db.query(
        "INSERT INTO proyectos (cliente_id, nombre_proyecto, descripcion, fecha_inicio, tipo, estado) VALUES (?, ?, 'Proyecto 2 para factura multi-asignación', '2026-02-02', 'DISENO', 'EN_CURSO')",
        [clienteId, `Proyecto B ${sufijo}`]
    );
    proyecto2Id = resProy2.insertId;
    idsLimpieza.proyectos.push(proyecto2Id);
    await db.query(
        "INSERT INTO proyectos_diseno (proyecto_id, tipo, software_utilizado, formato_entrega) VALUES (?, 'DISENO', 'Figma', 'SVG')",
        [proyecto2Id]
    );
});

after(async () => {
    if (db) {
        try {
            for (const fId of idsLimpieza.facturas) {
                await db.query("UPDATE facturas SET estado_factura = 'RECHAZADA' WHERE id = ? AND estado_factura = 'PENDIENTE'", [fId]);
            }
            if (idsLimpieza.asignaciones.length > 0) {
                await db.query('DELETE FROM registros_tiempo WHERE asignacion_id IN (?)', [idsLimpieza.asignaciones]);
                await db.query('DELETE FROM asignaciones WHERE id IN (?)', [idsLimpieza.asignaciones]);
            }
            if (idsLimpieza.facturas.length > 0) {
                await db.query('DELETE FROM facturas WHERE id IN (?)', [idsLimpieza.facturas]);
            }
            if (idsLimpieza.proyectos.length > 0) {
                await db.query('DELETE FROM proyectos WHERE id IN (?)', [idsLimpieza.proyectos]);
            }
            if (idsLimpieza.usuarios.length > 0) {
                await db.query('DELETE FROM clientes WHERE usuario_id IN (?)', [idsLimpieza.usuarios]);
                await db.query('DELETE FROM trabajadores WHERE usuario_id IN (?)', [idsLimpieza.usuarios]);
                await db.query('DELETE FROM usuarios WHERE id IN (?)', [idsLimpieza.usuarios]);
            }
        } finally {
            await db.end();
        }
    }
    if (app.db && typeof app.db.end === 'function') {
        await app.db.end();
    }
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
});

test('1. Acceso directo sin X-Internal-Key responde 403 con formato {status, message}', async () => {
    const res = await peticion('GET', '/asignaciones', undefined, false);
    assert.equal(res.status, 403);
    assert.equal(res.data.status, 'error');
    assert.equal(typeof res.data.message, 'string');
});

test('2. Salud del servicio y formato de error unificado en 404', async () => {
    const salud = await peticion('GET', '/health', undefined, false);
    assert.equal(salud.status, 200);
    assert.equal(salud.data.database, 'ok');

    const noExiste = await peticion('GET', '/asignaciones/9999999');
    assert.equal(noExiste.status, 404);
    assert.deepEqual(Object.keys(noExiste.data).sort(), ['message', 'status']);
    assert.equal(noExiste.data.status, 'error');
});

test('3. Crear dos asignaciones para el mismo trabajador en distintos proyectos y rechazar duplicada con 409', async () => {
    const c1 = await peticion('POST', '/asignaciones', {
        trabajador_id: trabajadorId,
        proyecto_id: proyecto1Id,
        rol_en_proyecto: 'Desarrollador Backend',
        tarifa_por_hora: 50
    });
    assert.equal(c1.status, 201);
    assert.equal(c1.data.status, 'success');
    asignacion1Id = c1.data.id;
    idsLimpieza.asignaciones.push(asignacion1Id);

    const c2 = await peticion('POST', '/asignaciones', {
        trabajador_id: trabajadorId,
        proyecto_id: proyecto2Id,
        rol_en_proyecto: 'Diseñador UI',
        tarifa_por_hora: 80
    });
    assert.equal(c2.status, 201);
    asignacion2Id = c2.data.id;
    idsLimpieza.asignaciones.push(asignacion2Id);

    const duplicada = await peticion('POST', '/asignaciones', {
        trabajador_id: trabajadorId,
        proyecto_id: proyecto1Id,
        rol_en_proyecto: 'Otro Rol',
        tarifa_por_hora: 60
    });
    assert.equal(duplicada.status, 409);
    assert.equal(duplicada.data.status, 'error');
});

test('4. Temporizador: iniciar (200), temporizador duplicado (409), solapamiento (409) y detener (200)', async () => {
    const inicio = await peticion('POST', `/asignaciones/${asignacion1Id}/temporizador`);
    assert.equal(inicio.status, 200);
    assert.equal(inicio.data.status, 'success');

    // Temporizador duplicado sobre la misma asignación -> 409
    const duplicadoMisma = await peticion('POST', `/asignaciones/${asignacion1Id}/temporizador`);
    assert.equal(duplicadoMisma.status, 409);
    assert.equal(duplicadoMisma.data.status, 'error');

    // Solapamiento de temporizador en otra asignación del mismo trabajador -> 409
    const solapadoOtra = await peticion('POST', `/asignaciones/${asignacion2Id}/temporizador`);
    assert.equal(solapadoOtra.status, 409);
    assert.equal(solapadoOtra.data.status, 'error');

    // Detener temporizador crea registro PENDIENTE
    const detenido = await peticion('DELETE', `/asignaciones/${asignacion1Id}/temporizador`);
    assert.equal(detenido.status, 200);
    assert.equal(detenido.data.status, 'success');
    assert.ok(detenido.data.registroTiempoId > 0);
    registroTimerId = detenido.data.registroTiempoId;
});

test('5. Registrar horas manuales en ambas asignaciones con ruta sustantiva y aprobar con tarifa histórica', async () => {
    // 2 horas en asignación 1 (tarifa 50 -> $100)
    const h1 = await peticion('POST', `/asignaciones/${asignacion1Id}/registros-tiempo`, {
        horas: 2
    });
    assert.equal(h1.status, 201);
    registroManual1Id = h1.data.registroTiempoId;

    // 3 horas en asignación 2 (tarifa 80 -> $240)
    const h2 = await peticion('POST', `/asignaciones/${asignacion2Id}/registros-tiempo`, {
        horas: 3
    });
    assert.equal(h2.status, 201);
    registroManual2Id = h2.data.registroTiempoId;

    // Aprobar los dos registros manuales
    const ap1 = await peticion('PATCH', `/registros-tiempo/${registroManual1Id}`, { estado: 'APROBADO' });
    assert.equal(ap1.status, 200);
    assert.equal(ap1.data.estado, 'APROBADO');
    assert.equal(Number(ap1.data.tarifa_aplicada), 50);

    const ap2 = await peticion('PATCH', `/registros-tiempo/${registroManual2Id}`, { estado: 'APROBADO' });
    assert.equal(ap2.status, 200);
    assert.equal(ap2.data.estado, 'APROBADO');
    assert.equal(Number(ap2.data.tarifa_aplicada), 80);

    // Cambiar la tarifa de la asignación 1 de 50 a 120 después de aprobar
    const cambioTarifa = await peticion('PATCH', `/asignaciones/${asignacion1Id}`, {
        tarifa_por_hora: 120
    });
    assert.equal(cambioTarifa.status, 200);

    // Verificar que las 2h aprobadas conservan su tarifa histórica de 50
    const valorAsig1 = await peticion('GET', `/asignaciones/${asignacion1Id}/valor`);
    assert.equal(valorAsig1.status, 200);
    assert.equal(Number(valorAsig1.data.horasAprobadas), 2);
});

test('6. Generar una factura que agrupa varias asignaciones, respeta la tarifa histórica y congela los registros', async () => {
    const resFactura = await peticion('POST', '/facturas', {
        trabajador_id: trabajadorId,
        cliente_id: clienteId
    });
    assert.equal(resFactura.status, 201);
    assert.equal(resFactura.data.status, 'success');
    assert.equal(resFactura.data.registrosCongelados, 2);
    // 2h * $50 (tarifa histórica de asignación 1, no $120) + 3h * $80 (asignación 2) = $100 + $240 = $340
    assert.equal(Number(resFactura.data.valorTotal), 340);
    facturaId = resFactura.data.idFactura;
    idsLimpieza.facturas.push(facturaId);

    // Verificar en GET /facturas/:id que incluye los registros de ambas asignaciones en estado CONGELADO
    const detalle = await peticion('GET', `/facturas/${facturaId}`);
    assert.equal(detalle.status, 200);
    assert.equal(detalle.data.data.registros_tiempo.length, 2);
    const asignacionesEnFactura = new Set(detalle.data.data.registros_tiempo.map(r => Number(r.asignacion_id)));
    assert.equal(asignacionesEnFactura.size, 2);
    assert.ok(detalle.data.data.registros_tiempo.every(r => r.estado === 'CONGELADO'));
});

test('7. Bloqueo de registros congelados: no permite modificar ni eliminar registros, asignaciones o facturas congeladas (409)', async () => {
    const modCongelado = await peticion('PATCH', `/registros-tiempo/${registroManual1Id}`, {
        tarifa_aplicada: 999
    });
    assert.equal(modCongelado.status, 409);
    assert.equal(modCongelado.data.status, 'error');

    const delCongelado = await peticion('DELETE', `/registros-tiempo/${registroManual1Id}`);
    assert.equal(delCongelado.status, 409);
    assert.equal(delCongelado.data.status, 'error');

    const delAsignacion = await peticion('DELETE', `/asignaciones/${asignacion1Id}`);
    assert.equal(delAsignacion.status, 409);
    assert.equal(delAsignacion.data.status, 'error');

    const delFactura = await peticion('DELETE', `/facturas/${facturaId}`);
    assert.equal(delFactura.status, 409);
    assert.equal(delFactura.data.status, 'error');

    // En cambio, un registro PENDIENTE (no congelado) sí se puede eliminar
    const delPendiente = await peticion('DELETE', `/registros-tiempo/${registroTimerId}`);
    assert.equal(delPendiente.status, 200);
});

test('8. Rechazar factura pendiente libera los registros congelados a estado APROBADO', async () => {
    const rechazo = await peticion('PATCH', `/facturas/${facturaId}`, {
        estado_factura: 'RECHAZADA'
    });
    assert.equal(rechazo.status, 200);
    assert.equal(rechazo.data.estado_factura, 'RECHAZADA');

    const regLiberado = await peticion('GET', `/registros-tiempo/${registroManual1Id}`);
    assert.equal(regLiberado.status, 200);
    assert.equal(regLiberado.data.data.estado, 'APROBADO');
    assert.equal(regLiberado.data.data.factura_id, null);
});
