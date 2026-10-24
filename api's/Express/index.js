require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'plataforma_freelance',
    waitForConnections: true,
    connectionLimit: 10
});

const ESTADOS_FACTURA_VALIDOS = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'PAGADA'];
const ESTADOS_TIEMPO_VALIDOS = ['PENDIENTE', 'APROBADO', 'CONGELADO'];
const INTERNAL_API_KEY = (process.env.INTERNAL_API_KEY || 'clave-interna-gateway-freelancer-2026').trim();

// =========================================================================
// SALUD DEL SERVICIO Y PROTECCIÓN INTERNA (SOLO GATEWAY)
// =========================================================================
app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'API Tiempo y Facturacion (Express)' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'API Tiempo y Facturacion (Express)' });
});

app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        return next();
    }
    const claveRecibida = req.header('X-Internal-Key') || '';
    if (claveRecibida !== INTERNAL_API_KEY) {
        return res.status(403).json({
            status: 'error',
            message: 'Acceso directo no permitido; use el API Gateway'
        });
    }
    next();
});

function manejarErrorTriggerOBD(res, error, contexto) {
    console.error(`Error en ${contexto}:`, error);
    if (error && error.sqlState === '45000') {
        return res.status(409).json({
            status: 'error',
            error: error.sqlMessage || error.message
        });
    }
    if (error && error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
            status: 'error',
            error: 'El trabajador ya está asignado a este proyecto'
        });
    }
    if (error && error.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(404).json({
            status: 'error',
            error: 'El recurso referenciado (trabajador, cliente, proyecto o asignación) no existe'
        });
    }
    return res.status(500).json({ status: 'error', error: 'Error en el servidor' });
}

// =========================================================================
// ASIGNACIONES
// =========================================================================
app.get('/asignaciones', async (req, res) => {
    const { trabajador_id, proyecto_id } = req.query;
    try {
        let sql = 'SELECT id, trabajador_id, proyecto_id, rol_en_proyecto, tarifa_por_hora, temporizador_inicio FROM asignaciones WHERE 1=1';
        const params = [];

        if (trabajador_id !== undefined) {
            sql += ' AND trabajador_id = ?';
            params.push(Number(trabajador_id));
        }
        if (proyecto_id !== undefined) {
            sql += ' AND proyecto_id = ?';
            params.push(Number(proyecto_id));
        }
        sql += ' ORDER BY id ASC';

        const [filas] = await db.query(sql, params);
        res.json({ status: 'success', data: filas });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'GET /asignaciones');
    }
});

app.get('/asignaciones/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [filas] = await db.query(
            'SELECT id, trabajador_id, proyecto_id, rol_en_proyecto, tarifa_por_hora, temporizador_inicio FROM asignaciones WHERE id = ?',
            [id]
        );
        if (filas.length === 0) {
            return res.status(404).json({ status: 'error', error: 'Asignación no encontrada' });
        }
        res.json({ status: 'success', data: filas[0] });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'GET /asignaciones/:id');
    }
});

app.post('/asignaciones', async (req, res) => {
    const trabajadorId = req.body.trabajador_id ?? req.body.usuario_id;
    const { proyecto_id, rol_en_proyecto, tarifa_por_hora } = req.body;

    if (
        trabajadorId === undefined || isNaN(Number(trabajadorId)) ||
        proyecto_id === undefined || isNaN(Number(proyecto_id)) ||
        !rol_en_proyecto ||
        tarifa_por_hora === undefined || isNaN(Number(tarifa_por_hora))
    ) {
        return res.status(400).json({
            status: 'error',
            error: "Los campos 'trabajador_id', 'proyecto_id', 'rol_en_proyecto' y 'tarifa_por_hora' son obligatorios"
        });
    }

    if (Number(tarifa_por_hora) <= 0) {
        return res.status(400).json({
            status: 'error',
            error: "El campo 'tarifa_por_hora' debe ser mayor que cero"
        });
    }

    try {
        const [resultado] = await db.query(
            'INSERT INTO asignaciones (trabajador_id, proyecto_id, rol_en_proyecto, tarifa_por_hora) VALUES (?, ?, ?, ?)',
            [Number(trabajadorId), Number(proyecto_id), String(rol_en_proyecto).trim(), Number(tarifa_por_hora)]
        );
        res.status(201).json({
            status: 'success',
            message: 'Asignación creada correctamente',
            id: resultado.insertId
        });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'POST /asignaciones');
    }
});

app.patch('/asignaciones/:id', async (req, res) => {
    const { id } = req.params;
    const { rol_en_proyecto, tarifa_por_hora } = req.body;

    const sets = [];
    const valores = [];

    if (rol_en_proyecto !== undefined) {
        if (!String(rol_en_proyecto).trim()) {
            return res.status(400).json({ status: 'error', error: 'rol_en_proyecto no puede estar vacío' });
        }
        sets.push('rol_en_proyecto = ?');
        valores.push(String(rol_en_proyecto).trim());
    }

    if (tarifa_por_hora !== undefined) {
        if (isNaN(Number(tarifa_por_hora)) || Number(tarifa_por_hora) <= 0) {
            return res.status(400).json({ status: 'error', error: 'tarifa_por_hora debe ser mayor que cero' });
        }
        sets.push('tarifa_por_hora = ?');
        valores.push(Number(tarifa_por_hora));
    }

    if (sets.length === 0) {
        return res.status(400).json({ status: 'error', error: 'Envía al menos rol_en_proyecto o tarifa_por_hora' });
    }

    try {
        valores.push(id);
        const [resultado] = await db.query(
            `UPDATE asignaciones SET ${sets.join(', ')} WHERE id = ?`,
            valores
        );
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ status: 'error', error: 'Asignación no encontrada' });
        }
        res.json({ status: 'success', message: 'Asignación actualizada correctamente' });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'PATCH /asignaciones/:id');
    }
});

app.delete('/asignaciones/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [resultado] = await db.query('DELETE FROM asignaciones WHERE id = ?', [id]);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ status: 'error', error: 'Asignación no encontrada' });
        }
        res.json({ status: 'success', message: 'Asignación eliminada correctamente' });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'DELETE /asignaciones/:id');
    }
});

// =========================================================================
// TEMPORIZADOR Y HORAS MANUALES (SOBRE asignaciones Y registros_tiempo)
// =========================================================================

// Iniciar temporizador evitando solapamiento por trabajador_id
app.patch('/asignaciones/:id/iniciar-temporizador', async (req, res) => {
    const { id } = req.params;

    try {
        const [asignaciones] = await db.query(
            'SELECT id, trabajador_id, temporizador_inicio FROM asignaciones WHERE id = ?',
            [id]
        );

        if (asignaciones.length === 0) {
            return res.status(404).json({ message: 'Asignación no encontrada' });
        }

        const asignacion = asignaciones[0];
        if (asignacion.temporizador_inicio !== null) {
            return res.status(400).json({
                error: 'El temporizador de esta asignación ya se encuentra activo.'
            });
        }

        const [activos] = await db.query(
            'SELECT id FROM asignaciones WHERE trabajador_id = ? AND temporizador_inicio IS NOT NULL AND id != ?',
            [asignacion.trabajador_id, id]
        );

        if (activos.length > 0) {
            return res.status(400).json({
                error: 'Solapamiento detectado: El trabajador ya tiene un temporizador activo.'
            });
        }

        await db.query(
            'UPDATE asignaciones SET temporizador_inicio = NOW() WHERE id = ?',
            [id]
        );

        res.json({ message: 'Temporizador iniciado correctamente' });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'PATCH /asignaciones/:id/iniciar-temporizador');
    }
});

// Detener temporizador y crear el registro en registros_tiempo
app.patch('/asignaciones/:id/detener-temporizador', async (req, res) => {
    const { id } = req.params;

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [asignaciones] = await conn.query(
            'SELECT id, temporizador_inicio, tarifa_por_hora, GREATEST(TIMESTAMPDIFF(SECOND, temporizador_inicio, NOW()), 1) AS segundos_transcurridos FROM asignaciones WHERE id = ? FOR UPDATE',
            [id]
        );

        if (asignaciones.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Asignación no encontrada' });
        }

        const asignacion = asignaciones[0];
        if (asignacion.temporizador_inicio === null) {
            await conn.rollback();
            return res.status(400).json({ error: 'No hay un temporizador activo en esta asignación' });
        }

        const segundos = Number(asignacion.segundos_transcurridos) || 1;
        const horasCalculadas = Math.max(Number((segundos / 3600).toFixed(2)), 0.01);

        const [insertRes] = await conn.query(
            `INSERT INTO registros_tiempo (asignacion_id, inicio, fin, horas, tarifa_aplicada, origen, estado)
             VALUES (?, ?, DATE_ADD(?, INTERVAL ? SECOND), ?, NULL, 'TEMPORIZADOR', 'PENDIENTE')`,
            [id, asignacion.temporizador_inicio, asignacion.temporizador_inicio, segundos, horasCalculadas]
        );

        await conn.query(
            'UPDATE asignaciones SET temporizador_inicio = NULL WHERE id = ?',
            [id]
        );

        await conn.commit();

        res.json({
            message: 'Temporizador detenido correctamente',
            registroTiempoId: insertRes.insertId,
            horasRegistradas: horasCalculadas
        });
    } catch (error) {
        await conn.rollback();
        manejarErrorTriggerOBD(res, error, 'PATCH /asignaciones/:id/detener-temporizador');
    } finally {
        conn.release();
    }
});

// Registrar horas manuales en registros_tiempo
app.post('/asignaciones/:id/horas-manuales', async (req, res) => {
    const { id } = req.params;
    const { horas, inicio, fin } = req.body;

    if (horas === undefined || horas === null || isNaN(Number(horas))) {
        return res.status(400).json({ error: 'El campo horas es obligatorio y debe ser numerico' });
    }

    const numHoras = Number(horas);
    if (numHoras <= 0 || numHoras > 999.99) {
        return res.status(400).json({ error: 'Las horas deben ser mayores que cero y menores a 1000' });
    }

    try {
        const [asignaciones] = await db.query(
            'SELECT id FROM asignaciones WHERE id = ?',
            [id]
        );
        if (asignaciones.length === 0) {
            return res.status(404).json({ error: 'Asignación no encontrada' });
        }

        let insertRes;
        if (inicio && fin) {
            [insertRes] = await db.query(
                `INSERT INTO registros_tiempo (asignacion_id, inicio, fin, horas, tarifa_aplicada, origen, estado)
                 VALUES (?, ?, ?, ?, NULL, 'MANUAL', 'PENDIENTE')`,
                [id, inicio, fin, numHoras]
            );
        } else {
            const segundos = Math.max(Math.round(numHoras * 3600), 1);
            [insertRes] = await db.query(
                `INSERT INTO registros_tiempo (asignacion_id, inicio, fin, horas, tarifa_aplicada, origen, estado)
                 VALUES (?, DATE_SUB(NOW(), INTERVAL ? SECOND), NOW(), ?, NULL, 'MANUAL', 'PENDIENTE')`,
                [id, segundos, numHoras]
            );
        }

        res.status(201).json({
            mensaje: 'Horas registradas correctamente',
            registroTiempoId: insertRes.insertId,
            horas: numHoras
        });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'POST /asignaciones/:id/horas-manuales');
    }
});

// Calcular el valor acumulado de la asignación a partir de registros_tiempo
app.get('/asignaciones/:id/calcular-valor', async (req, res) => {
    const { id } = req.params;

    try {
        const [asignaciones] = await db.query(
            'SELECT id, trabajador_id, proyecto_id, tarifa_por_hora FROM asignaciones WHERE id = ?',
            [id]
        );

        if (asignaciones.length === 0) {
            return res.status(404).json({ error: 'Asignación no encontrada' });
        }

        const asignacion = asignaciones[0];
        const tarifaPorHora = Number(asignacion.tarifa_por_hora);

        const [resumen] = await db.query(
            `SELECT
                COALESCE(SUM(horas), 0) AS horas_totales,
                COALESCE(SUM(CASE WHEN estado = 'PENDIENTE' THEN horas ELSE 0 END), 0) AS horas_pendientes,
                COALESCE(SUM(CASE WHEN estado = 'APROBADO' THEN horas ELSE 0 END), 0) AS horas_aprobadas,
                COALESCE(SUM(CASE WHEN estado = 'CONGELADO' THEN horas ELSE 0 END), 0) AS horas_congeladas,
                COALESCE(SUM(horas * COALESCE(tarifa_aplicada, ?)), 0) AS valor_total
             FROM registros_tiempo
             WHERE asignacion_id = ?`,
            [tarifaPorHora, id]
        );

        const fila = resumen[0];
        res.json({
            asignacion: Number(id),
            horasAcumuladas: Number(fila.horas_totales),
            horasPendientes: Number(fila.horas_pendientes),
            horasAprobadas: Number(fila.horas_aprobadas),
            horasCongeladas: Number(fila.horas_congeladas),
            tarifaPorHora,
            valorTotal: Number(Number(fila.valor_total).toFixed(2))
        });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'GET /asignaciones/:id/calcular-valor');
    }
});

// =========================================================================
// REGISTROS DE TIEMPO (APROBACIÓN, CONSULTA Y BORRADO)
// =========================================================================
app.get('/asignaciones/:id/registros-tiempo', async (req, res) => {
    const { id } = req.params;
    try {
        const [registros] = await db.query(
            'SELECT id, asignacion_id, inicio, fin, horas, tarifa_aplicada, origen, estado, factura_id FROM registros_tiempo WHERE asignacion_id = ? ORDER BY id ASC',
            [id]
        );
        res.json({ status: 'success', data: registros });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'GET /asignaciones/:id/registros-tiempo');
    }
});

app.get('/registros-tiempo', async (req, res) => {
    const { asignacion_id, estado, factura_id } = req.query;
    try {
        let sql = 'SELECT id, asignacion_id, inicio, fin, horas, tarifa_aplicada, origen, estado, factura_id FROM registros_tiempo WHERE 1=1';
        const params = [];

        if (asignacion_id !== undefined) {
            sql += ' AND asignacion_id = ?';
            params.push(Number(asignacion_id));
        }
        if (estado !== undefined) {
            sql += ' AND estado = ?';
            params.push(String(estado).toUpperCase());
        }
        if (factura_id !== undefined) {
            sql += ' AND factura_id = ?';
            params.push(Number(factura_id));
        }
        sql += ' ORDER BY id ASC';

        const [registros] = await db.query(sql, params);
        res.json({ status: 'success', data: registros });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'GET /registros-tiempo');
    }
});

// Aprobar o actualizar estado de un registro de tiempo (cumpliendo chk_tarifa_obligatoria)
app.patch('/registros-tiempo/:id/aprobar', async (req, res) => {
    const { id } = req.params;
    const { tarifa_aplicada } = req.body || {};

    try {
        const [filas] = await db.query(
            `SELECT rt.id, rt.estado, a.tarifa_por_hora
             FROM registros_tiempo rt
             INNER JOIN asignaciones a ON a.id = rt.asignacion_id
             WHERE rt.id = ?`,
            [id]
        );

        if (filas.length === 0) {
            return res.status(404).json({ error: 'Registro de tiempo no encontrado' });
        }

        const tarifaFinal = tarifa_aplicada !== undefined && tarifa_aplicada !== null
            ? Number(tarifa_aplicada)
            : Number(filas[0].tarifa_por_hora);

        if (isNaN(tarifaFinal) || tarifaFinal <= 0) {
            return res.status(400).json({ error: 'tarifa_aplicada debe ser mayor que cero' });
        }

        await db.query(
            "UPDATE registros_tiempo SET estado = 'APROBADO', tarifa_aplicada = ? WHERE id = ?",
            [tarifaFinal, id]
        );

        res.json({
            mensaje: 'Registro de tiempo aprobado correctamente',
            id: Number(id),
            estado: 'APROBADO',
            tarifa_aplicada: tarifaFinal
        });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'PATCH /registros-tiempo/:id/aprobar');
    }
});

app.delete('/registros-tiempo/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [resultado] = await db.query('DELETE FROM registros_tiempo WHERE id = ?', [id]);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: 'Registro de tiempo no encontrado' });
        }
        res.json({ mensaje: 'Registro de tiempo eliminado correctamente' });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'DELETE /registros-tiempo/:id');
    }
});

// =========================================================================
// FACTURAS
// =========================================================================
app.get('/facturas', async (req, res) => {
    const { cliente_id, trabajador_id, estado_factura } = req.query;
    try {
        let sql = 'SELECT id, cliente_id, trabajador_id, fecha_emision, valor_total, estado_factura FROM facturas WHERE 1=1';
        const params = [];

        if (cliente_id !== undefined) {
            sql += ' AND cliente_id = ?';
            params.push(Number(cliente_id));
        }
        if (trabajador_id !== undefined) {
            sql += ' AND trabajador_id = ?';
            params.push(Number(trabajador_id));
        }
        if (estado_factura !== undefined) {
            sql += ' AND estado_factura = ?';
            params.push(String(estado_factura).toUpperCase());
        }
        sql += ' ORDER BY id DESC';

        const [facturas] = await db.query(sql, params);
        res.json({ status: 'success', data: facturas });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'GET /facturas');
    }
});

app.get('/facturas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [facturas] = await db.query(
            'SELECT id, cliente_id, trabajador_id, fecha_emision, valor_total, estado_factura FROM facturas WHERE id = ?',
            [id]
        );
        if (facturas.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }
        const [registros] = await db.query(
            'SELECT id, asignacion_id, inicio, fin, horas, tarifa_aplicada, origen, estado FROM registros_tiempo WHERE factura_id = ?',
            [id]
        );
        res.json({
            status: 'success',
            data: {
                ...facturas[0],
                registros_tiempo: registros
            }
        });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'GET /facturas/:id');
    }
});

// Generar factura a partir de registros_tiempo en estado APROBADO y congelarlos
app.post('/facturas', async (req, res) => {
    const trabajadorId = req.body.trabajador_id ?? req.body.idUsuario;
    const clienteIdBody = req.body.cliente_id ?? req.body.idCliente;
    const proyectoIdBody = req.body.proyecto_id;

    if (trabajadorId === undefined || trabajadorId === null || isNaN(Number(trabajadorId))) {
        return res.status(400).json({
            error: 'El campo trabajador_id (o idUsuario) es obligatorio y debe ser numerico'
        });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        let sql = `
            SELECT
                rt.id AS registro_id,
                rt.horas,
                COALESCE(rt.tarifa_aplicada, a.tarifa_por_hora) AS tarifa_efectiva,
                p.cliente_id
            FROM registros_tiempo rt
            INNER JOIN asignaciones a ON a.id = rt.asignacion_id
            INNER JOIN proyectos p ON p.id = a.proyecto_id
            WHERE a.trabajador_id = ?
              AND rt.estado = 'APROBADO'
              AND rt.factura_id IS NULL
        `;
        const params = [Number(trabajadorId)];

        if (clienteIdBody !== undefined && clienteIdBody !== null) {
            sql += ' AND p.cliente_id = ?';
            params.push(Number(clienteIdBody));
        }
        if (proyectoIdBody !== undefined && proyectoIdBody !== null) {
            sql += ' AND p.id = ?';
            params.push(Number(proyectoIdBody));
        }

        sql += ' FOR UPDATE';

        const [registros] = await conn.query(sql, params);

        if (registros.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'No hay horas aprobadas para facturar' });
        }

        const clientesDistintos = [...new Set(registros.map(r => r.cliente_id))];
        if (clientesDistintos.length > 1) {
            await conn.rollback();
            return res.status(400).json({
                error: 'Existen horas aprobadas de distintos clientes. Especifica cliente_id en el cuerpo de la petición.'
            });
        }

        const clienteId = clientesDistintos[0];
        let valorTotal = 0;
        const idsRegistros = [];

        registros.forEach(reg => {
            valorTotal += Number(reg.horas) * Number(reg.tarifa_efectiva);
            idsRegistros.push(reg.registro_id);
        });

        valorTotal = Number(valorTotal.toFixed(2));

        const [resultadoFactura] = await conn.query(
            `INSERT INTO facturas (cliente_id, trabajador_id, fecha_emision, valor_total, estado_factura)
             VALUES (?, ?, CURDATE(), ?, 'PENDIENTE')`,
            [clienteId, Number(trabajadorId), valorTotal]
        );

        const facturaId = resultadoFactura.insertId;

        await conn.query(
            `UPDATE registros_tiempo rt
             INNER JOIN asignaciones a ON a.id = rt.asignacion_id
             SET rt.estado = 'CONGELADO',
                 rt.tarifa_aplicada = COALESCE(rt.tarifa_aplicada, a.tarifa_por_hora),
                 rt.factura_id = ?
             WHERE rt.id IN (?)`,
            [facturaId, idsRegistros]
        );

        await conn.commit();

        res.status(201).json({
            mensaje: 'Factura generada y registros congelados con exito',
            idFactura: facturaId,
            cliente_id: clienteId,
            trabajador_id: Number(trabajadorId),
            estado_factura: 'PENDIENTE',
            registrosCongelados: idsRegistros.length,
            valorTotal
        });
    } catch (error) {
        await conn.rollback();
        manejarErrorTriggerOBD(res, error, 'POST /facturas');
    } finally {
        conn.release();
    }
});

// Cambiar el estado de la factura (PENDIENTE -> APROBADA | RECHAZADA | PAGADA)
// Si pasa a RECHAZADA, el trigger trg_factura_rechazada_libera libera los registros_tiempo a APROBADO
app.patch('/facturas/:id/estado', async (req, res) => {
    const { id } = req.params;
    const estadoNuevo = (req.body.estado_factura ?? req.body.estado ?? '').toString().trim().toUpperCase();

    if (!ESTADOS_FACTURA_VALIDOS.includes(estadoNuevo)) {
        return res.status(400).json({
            error: `estado_factura debe ser uno de: ${ESTADOS_FACTURA_VALIDOS.join(', ')}`
        });
    }

    try {
        const [resultado] = await db.query(
            'UPDATE facturas SET estado_factura = ? WHERE id = ?',
            [estadoNuevo, id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        res.json({
            mensaje: `Estado de la factura actualizado a ${estadoNuevo}`,
            idFactura: Number(id),
            estado_factura: estadoNuevo
        });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'PATCH /facturas/:id/estado');
    }
});

app.delete('/facturas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [resultado] = await db.query('DELETE FROM facturas WHERE id = ?', [id]);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }
        res.json({ mensaje: 'Factura eliminada correctamente' });
    } catch (error) {
        manejarErrorTriggerOBD(res, error, 'DELETE /facturas/:id');
    }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
if (require.main === module) {
    app.listen(PORT, HOST, () => {
        console.log(`API Express corriendo en http://${HOST}:${PORT} (solo acceso local / Gateway)`);
    });
}

module.exports = app;
