// hola
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'plataforma_freelance',
    waitForConnections: true,
    connectionLimit: 10
});

// Se inicia esta vuelta broderch evitando el solapamiento crack
app.patch('/asiganaciones/:id/iniciar-temporizador', async (req, res) => {
  const { id } = req.params;

  try {
    const [asiganaciones] = await db.query(
        'SESLECT idUsuario FROM asiganaciones WHERE idAsiganacion = ?',
        [id]
    );

if (asiganaciones.length === 0) {
    return res.status(404).json({ message: 'Asignación no encontrada' });
}

const idUsuario = asiganaciones[0].idUsuario;

const [activos] = await db.query(
    'SELECT * FROM activos WHERE idUsuario = ? AND temporizador = TRUE',
    [idUsuario]
);

//esto valida si la persona ojo con esto "PERSONA" no IA, tiene un temporizador activo, si lo tiene no puede iniciar otro
if (activos.length > 0) {
    return res.status(400).json({
    error: 'Solapamiento detectado: El usuario ya tiene un temporizador activo.'
});
}

await db.query(
    'UPDATE asiganaciones SET temporizador = TRUE WHERE idAsiganacion = ?',
    [id]
);

res.json({ message: 'Temporizador iniciado correctamente' });
} catch (error) {
    res.status(500).json({ error: 'Error en el servidor' + error.message });
}
});

// master esto detiene estea vuelta
app.patch('/asiganaciones/:id/detener-temporizador', async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
        'UPDATE asiganaciones SET temporizador = FALSE WHERE idAsiganacion = ?',
        [id]
    );

    res.json({ message: 'Temporizador detenido correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor' + error.message });
    }
});

// Ahora vamos a registrar las horinhas manuales papa 
app.post('/asignaciones/:id/horas-manuales', async (req, res) => {
  const { id } = req.params;
  const { horas} = req.body;

  try {
    await db.query(
        'UPDATE asignaciones SET horasAcumuladas = horasAcumuladas + ? WHERE idAsignacion = ?',
        [horas, id]
    );
  res.json({ mensaje: 'Horas registradas correctamente' });

    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor' + error.message });
    }
});

//calculamos el valor de la tarea chavalito (horas x tarifa guardada)
app.get('/asignaciones/:id/calcular-valor', async (req, res) => {
  const { id } = req.params;

  try {
    const [filas] = await db.query(
        'SELECT horasAcumuladas, tarifaPorHora FROM asignaciones WHERE idAsignacion = ?',
        [id]
    );

    if (filas.length === 0) {
        return res.status(404).json({  error: 'Asignación no encontrada' });
    }

    const { horasAcumuladas, tarifaPorHora } = filas[0];
    const valorTotal = horasAcumuladas * tarifaPorHora;

    res.json({asignacion: id, horasAcumuladas, tarifaPorHora, valorTotal });
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor' + error.message });
    }
});

// DE AQUI EN ADELANTE TODO LA PARTE DE FACTURA //
app.post('/facturas', async (req, res) => {
    const { idUsuario } = req.body;

    try {
        //vamos a buscar registros aprobados
        const [registros] = await db.query(
            'SELECT idAsignacion, horasAcumuladas, tarifaPorHora FROM asignaciones WHERE idUsuario = ? AND estadoTiempo = "APROBADO"',
            [idUsuario]
        );

        if (registros.length === 0) {
            return res.status(404).json({ error: 'No hay horas aprobadas para facturar' });
        }

        let totalFactura = 0;
        const idAsignaciones = [];
        
        // se calcula el valor total sumando cada tarea chavalin
        registros.forEach(registro => {
            valorTotal += registro.horasAcumuladas * registro.tarifaPorHora;
            idAsignaciones.push(registro.idAsignacion);
        });
        
        //crear los registros de la factura
        await db.query(
            'INSERT INTO facturas (fechaEmision, valorTotal, estadoFactura) VALUES (NOW(), ?, "GENERADA")',
            [valorTotal]
        );

        await db.query(
            'UPDATE asignaciones SET estadoTiempo = "CONGELADO" WHERE idAsignacion IN (?)',
            [idAsignaciones]
        );

        res.json({
            mensaje: 'Factura generada y registros congelados con exito',
            idFactura: resultadoFactura.insertId,
            valorTotal
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor' + error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`API corriendo en http://localhost:${PORT}`);
});

//que onda papa, este es el index de la api, aqui se manejan las rutas y la conexion a la base de datos, si quieres agregar mas rutas, solo agregalas aqui y asegurate de que esten bien definidas.

