// hola
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// Se inicia esta vuelta broderch evitando el solapamiento crack
app.patch('/asignaciones/:id/iniciar-temporizador', async (req, res) => {
  const { id } = req.params;

  try {
    const [asignaciones] = await db.query(
        'SELECT usuario_id FROM asignaciones WHERE id = ?',
        [id]
    );

if (asignaciones.length === 0) {
    return res.status(404).json({ message: 'Asignación no encontrada' });
}

const idUsuario = asignaciones[0].usuario_id;

const [activos] = await db.query(
    'SELECT id FROM asignaciones WHERE usuario_id = ? AND temporizador_activo = TRUE AND id != ?',
    [idUsuario, id]
);

//esto valida si la persona ojo con esto "PERSONA" no IA, tiene un temporizador activo, si lo tiene no puede iniciar otro
if (activos.length > 0) {
    return res.status(400).json({
    error: 'Solapamiento detectado: El usuario ya tiene un temporizador activo.'
});
}

    await db.query(
        'UPDATE asignaciones SET temporizador_activo = TRUE WHERE id = ?',
        [id]
    );

res.json({ message: 'Temporizador iniciado correctamente' });
} catch (error) {
    console.error('Error en /asignaciones/:id/iniciar-temporizador:', error);
    res.status(500).json({ error: 'Error en el servidor' });
}
});

// master esto detiene estea vuelta
app.patch('/asignaciones/:id/detener-temporizador', async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
        'UPDATE asignaciones SET temporizador_activo = FALSE WHERE id = ?',
        [id]
    );

    res.json({ message: 'Temporizador detenido correctamente' });
    } catch (error) {
        console.error('Error en /asignaciones/:id/detener-temporizador:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Ahora vamos a registrar las horinhas manuales papa 
app.post('/asignaciones/:id/horas-manuales', async (req, res) => {
  const { id } = req.params;
  const { horas } = req.body;

  if (horas === undefined || horas === null || isNaN(Number(horas))) {
    return res.status(400).json({ error: 'El campo horas es obligatorio y debe ser numerico' });
  }

  if (Number(horas) <= 0) {
    return res.status(400).json({ error: 'Las horas deben ser mayores que cero' });
  }

  try {
    const [resultado] = await db.query(
        'UPDATE asignaciones SET horas_acumuladas = horas_acumuladas + ? WHERE id = ?',
        [Number(horas), id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

  res.json({ mensaje: 'Horas registradas correctamente' });

    } catch (error) {
        console.error('Error en /asignaciones/:id/horas-manuales:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

//calculamos el valor de la tarea chavalito (horas x tarifa guardada)
app.get('/asignaciones/:id/calcular-valor', async (req, res) => {
  const { id } = req.params;

  try {
    const [filas] = await db.query(
        'SELECT horas_acumuladas, tarifa_por_hora FROM asignaciones WHERE id = ?',
        [id]
    );

    if (filas.length === 0) {
        return res.status(404).json({  error: 'Asignación no encontrada' });
    }

    const { horas_acumuladas, tarifa_por_hora } = filas[0];
    const valorTotal = Number(horas_acumuladas) * Number(tarifa_por_hora);

    res.json({ asignacion: id, horasAcumuladas: Number(horas_acumuladas), tarifaPorHora: Number(tarifa_por_hora), valorTotal });
  } catch (error) {
    console.error('Error en /asignaciones/:id/calcular-valor:', error);
    res.status(500).json({ error: 'Error en el servidor' });
    }
});

// DE AQUI EN ADELANTE TODO LA PARTE DE FACTURA //
app.post('/facturas', async (req, res) => {
    const { idUsuario } = req.body;

    if (idUsuario === undefined || idUsuario === null || isNaN(Number(idUsuario))) {
        return res.status(400).json({ error: 'El campo idUsuario es obligatorio y debe ser numerico' });
    }

    try {
        //vamos a buscar registros aprobados
        const [registros] = await db.query(
            'SELECT id, horas_acumuladas, tarifa_por_hora FROM asignaciones WHERE usuario_id = ? AND estado_tiempo = "APROBADO"',
            [idUsuario]
        );

        if (registros.length === 0) {
            return res.status(404).json({ error: 'No hay horas aprobadas para facturar' });
        }

        let valorTotal = 0;
        const idAsignaciones = [];
        
        // se calcula el valor total sumando cada tarea chavalin
        registros.forEach(registro => {
            valorTotal += Number(registro.horas_acumuladas) * Number(registro.tarifa_por_hora);
            idAsignaciones.push(registro.id);
        });
        
        //crear los registros de la factura
        const [resultadoFactura] = await db.query(
            'INSERT INTO facturas (usuario_id, fecha_emision, valor_total, estado_factura) VALUES (?, NOW(), ?, "GENERADA")',
            [idUsuario, valorTotal]
        );

        await db.query(
        'UPDATE asignaciones SET estado_tiempo = "CONGELADO", factura_id = ? WHERE id IN (?)',
        [resultadoFactura.insertId, idAsignaciones]
        );

        res.json({
            mensaje: 'Factura generada y registros congelados con exito',
            idFactura: resultadoFactura.insertId,
            valorTotal
        });
    } catch (error) {
        console.error('Error en /facturas:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API corriendo en http://localhost:${PORT}`);
});

//que onda papa, este es el index de la api, aqui se manejan las rutas y la conexion a la base de datos, si quieres agregar mas rutas, solo agregalas aqui y asegurate de que esten bien definidas.

