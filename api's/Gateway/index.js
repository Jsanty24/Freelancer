require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Servir el Frontend de Stitch directamente desde el Gateway en /app
const FRONTEND_DIR = path.resolve(__dirname, '../../Frontend');
app.use('/app', express.static(FRONTEND_DIR));
app.get('/', (req, res) => {
    res.redirect('/app/index.html');
});

const PORT = Number(process.env.PORT) || 4000;
const PHP_API_URL = (process.env.PHP_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const PYTHON_API_URL = (process.env.PYTHON_API_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');
const EXPRESS_API_URL = (process.env.EXPRESS_API_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const INTERNAL_API_KEY = (process.env.INTERNAL_API_KEY || 'clave-interna-gateway-freelancer-2026').trim();
const JWT_SECRET = (process.env.JWT_SECRET || 'ZpRMXodtzvxILFzn0zjkmwTG4i7YCj1PkWFUql--Gg6lwpWdJMD3j8vjuhDm6us6').trim();
const JWT_EXPIRES_SECONDS = Number(process.env.JWT_EXPIRES_SECONDS) || 86400;

// =========================================================================
// UTILIDADES JWT (HS256 NATIVO CON CRYPTO)
// =========================================================================
function base64UrlEncode(strOrBuffer) {
    return Buffer.from(strOrBuffer)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
        base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
}

function firmarJWT(payloadObj) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const ahora = Math.floor(Date.now() / 1000);
    const payload = {
        ...payloadObj,
        iat: ahora,
        exp: ahora + JWT_EXPIRES_SECONDS
    };
    const segmentoHeader = base64UrlEncode(JSON.stringify(header));
    const segmentoPayload = base64UrlEncode(JSON.stringify(payload));
    const datosAFirmar = `${segmentoHeader}.${segmentoPayload}`;
    const firma = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(datosAFirmar)
        .digest();
    return `${datosAFirmar}.${base64UrlEncode(firma)}`;
}

function verificarJWT(token) {
    const partes = String(token || '').split('.');
    if (partes.length !== 3) {
        throw new Error('Formato de token inválido');
    }
    const [segmentoHeader, segmentoPayload, firmaRecibida] = partes;
    const datosAFirmar = `${segmentoHeader}.${segmentoPayload}`;
    const firmaEsperada = base64UrlEncode(
        crypto.createHmac('sha256', JWT_SECRET).update(datosAFirmar).digest()
    );

    const bufRecibida = Buffer.from(firmaRecibida);
    const bufEsperada = Buffer.from(firmaEsperada);
    if (bufRecibida.length !== bufEsperada.length || !crypto.timingSafeEqual(bufRecibida, bufEsperada)) {
        throw new Error('Firma del token inválida');
    }

    const payload = JSON.parse(base64UrlDecode(segmentoPayload));
    const ahora = Math.floor(Date.now() / 1000);
    if (payload.exp && ahora >= payload.exp) {
        const err = new Error('El token ha expirado');
        err.expired = true;
        throw err;
    }
    return payload;
}

// =========================================================================
// MIDDLEWARE DE SESIÓN JWT
// =========================================================================
app.use((req, res, next) => {
    const authHeader = req.header('Authorization') || '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();
        try {
            const payload = verificarJWT(token);
            req.usuario = {
                id: Number(payload.sub),
                rol: payload.rol,
                nombre: payload.nombre,
                email: payload.email
            };
        } catch (err) {
            return res.status(401).json({
                status: 'error',
                message: err.expired ? 'El token ha expirado' : 'Token inválido'
            });
        }
    }
    next();
});

function exigirAutenticacion(req, res, next) {
    if (!req.usuario) {
        return res.status(401).json({
            status: 'error',
            message: 'Falta el token de autenticación. Envía Authorization: Bearer <token>'
        });
    }
    next();
}

// =========================================================================
// CLIENTE HTTP INTERNO HACIA LOS 3 MICROSERVICIOS (CON X-Internal-Key)
// =========================================================================
async function llamarMicroservicio(baseUrl, method, pathConQuery, body = undefined) {
    const url = `${baseUrl}${pathConQuery.startsWith('/') ? pathConQuery : '/' + pathConQuery}`;
    const opciones = {
        method,
        headers: {
            'Accept': 'application/json',
            'X-Internal-Key': INTERNAL_API_KEY
        }
    };

    if (body !== undefined && body !== null && !['GET', 'HEAD'].includes(method.toUpperCase())) {
        opciones.headers['Content-Type'] = 'application/json';
        opciones.body = JSON.stringify(body);
    }

    const respuesta = await fetch(url, opciones);
    const texto = await respuesta.text();
    let json = null;
    if (texto) {
        try {
            json = JSON.parse(texto);
        } catch {
            json = { raw: texto };
        }
    }
    return { status: respuesta.status, data: json };
}

async function reenviarA(baseUrl, req, res, bodyOverride = undefined) {
    try {
        const bodyAEnviar = bodyOverride !== undefined
            ? bodyOverride
            : (['GET', 'HEAD'].includes(req.method) ? undefined : req.body);

        const resultado = await llamarMicroservicio(baseUrl, req.method, req.originalUrl, bodyAEnviar);
        if (resultado.status === 204 || resultado.data === null) {
            return res.status(resultado.status).end();
        }
        return res.status(resultado.status).json(resultado.data);
    } catch (error) {
        console.error(`Error comunicando con microservicio (${baseUrl}${req.originalUrl}):`, error.message);
        return res.status(502).json({
            status: 'error',
            message: 'El microservicio correspondiente no está disponible en este momento'
        });
    }
}

// =========================================================================
// ESTADO Y SALUD DEL GATEWAY Y MICROSERVICIOS
// =========================================================================
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'API Gateway Central - Plataforma Freelancer',
        microservicios: {
            usuarios_php: PHP_API_URL,
            proyectos_python: PYTHON_API_URL,
            tiempo_facturas_express: EXPRESS_API_URL
        }
    });
});

app.get('/health', async (req, res) => {
    const chequear = async (url) => {
        try {
            const r = await llamarMicroservicio(url, 'GET', '/health');
            return r.status === 200 ? 'ok' : `error (${r.status})`;
        } catch {
            return 'offline';
        }
    };

    const [php, python, expressApi] = await Promise.all([
        chequear(PHP_API_URL),
        chequear(PYTHON_API_URL),
        chequear(EXPRESS_API_URL)
    ]);

    const todosOk = php === 'ok' && python === 'ok' && expressApi === 'ok';
    res.status(todosOk ? 200 : 503).json({
        status: todosOk ? 'ok' : 'degraded',
        gateway: 'ok',
        services: {
            php_usuarios: php,
            python_proyectos: python,
            express_tiempo_facturas: expressApi
        }
    });
});

// =========================================================================
// AUTENTICACIÓN Y REGISTRO ORQUESTADO (/auth/login, /auth/registro, /auth/me)
// =========================================================================
async function manejarLogin(req, res) {
    try {
        const respuestaLogin = await llamarMicroservicio(PHP_API_URL, 'POST', '/login', req.body);
        if (respuestaLogin.status !== 200 || !respuestaLogin.data || !respuestaLogin.data.data) {
            return res.status(respuestaLogin.status).json(respuestaLogin.data);
        }

        const usuario = respuestaLogin.data.data;
        const token = firmarJWT({
            sub: String(usuario.id),
            rol: usuario.rol,
            nombre: usuario.nombre,
            email: usuario.email
        });

        return res.status(200).json({
            status: 'success',
            message: 'Inicio de sesión exitoso',
            token,
            usuario
        });
    } catch (error) {
        console.error('Error en /auth/login:', error.message);
        return res.status(502).json({
            status: 'error',
            message: 'El servicio de usuarios (PHP) no está disponible'
        });
    }
}

app.post('/auth/login', manejarLogin);
app.post('/login', manejarLogin);

// Registro completo en 1 paso: crea el usuario en PHP y opcionalmente su perfil en /clientes o /trabajadores
app.post('/auth/registro', async (req, res) => {
    const {
        nombre,
        email,
        telefono,
        password,
        rol,
        razon_social,
        direccion_facturacion,
        especialidad,
        disponibilidad
    } = req.body || {};

    try {
        const resUsuario = await llamarMicroservicio(PHP_API_URL, 'POST', '/usuarios', {
            nombre,
            email,
            telefono,
            password,
            rol
        });

        if (resUsuario.status !== 201) {
            return res.status(resUsuario.status).json(resUsuario.data);
        }

        const usuarioId = Number(resUsuario.data.id_creado);
        const rolNormalizado = String(rol || '').trim().toUpperCase();
        let perfilCreado = null;

        if (rolNormalizado === 'CLIENTE' && razon_social && direccion_facturacion) {
            const resCliente = await llamarMicroservicio(PHP_API_URL, 'POST', '/clientes', {
                usuario_id: usuarioId,
                razon_social,
                direccion_facturacion
            });
            if (resCliente.status !== 201) {
                await llamarMicroservicio(PHP_API_URL, 'DELETE', `/usuarios/${usuarioId}`);
                return res.status(resCliente.status).json(resCliente.data);
            }
            perfilCreado = { razon_social, direccion_facturacion };
        } else if (rolNormalizado === 'TRABAJADOR' && especialidad) {
            const resTrabajador = await llamarMicroservicio(PHP_API_URL, 'POST', '/trabajadores', {
                usuario_id: usuarioId,
                especialidad,
                disponibilidad: disponibilidad ?? true
            });
            if (resTrabajador.status !== 201) {
                await llamarMicroservicio(PHP_API_URL, 'DELETE', `/usuarios/${usuarioId}`);
                return res.status(resTrabajador.status).json(resTrabajador.data);
            }
            perfilCreado = { especialidad, disponibilidad: disponibilidad ?? true };
        }

        const token = firmarJWT({
            sub: String(usuarioId),
            rol: rolNormalizado,
            nombre,
            email
        });

        return res.status(201).json({
            status: 'success',
            message: 'Usuario registrado correctamente',
            token,
            usuario: {
                id: usuarioId,
                nombre,
                email,
                telefono: telefono ?? null,
                rol: rolNormalizado,
                perfil: perfilCreado
            }
        });
    } catch (error) {
        console.error('Error en /auth/registro:', error.message);
        return res.status(502).json({
            status: 'error',
            message: 'El servicio de usuarios (PHP) no está disponible'
        });
    }
});

app.get('/auth/me', exigirAutenticacion, async (req, res) => {
    try {
        const resUsuario = await llamarMicroservicio(PHP_API_URL, 'GET', `/usuarios/${req.usuario.id}`);
        if (resUsuario.status !== 200) {
            return res.status(resUsuario.status).json(resUsuario.data);
        }

        const datosUsuario = resUsuario.data.data;
        const rutaPerfil = datosUsuario.rol === 'CLIENTE'
            ? `/clientes/${req.usuario.id}`
            : `/trabajadores/${req.usuario.id}`;
        const resPerfil = await llamarMicroservicio(PHP_API_URL, 'GET', rutaPerfil);

        datosUsuario.perfil = resPerfil.status === 200 ? resPerfil.data.data : null;
        return res.json({ status: 'success', data: datosUsuario });
    } catch (error) {
        console.error('Error en /auth/me:', error.message);
        return res.status(502).json({
            status: 'error',
            message: 'El servicio de usuarios (PHP) no está disponible'
        });
    }
});

// =========================================================================
// RUTAS HACIA API 1 (PHP): /usuarios, /clientes, /trabajadores
// =========================================================================
app.use(['/usuarios', '/clientes', '/trabajadores'], (req, res) => {
    return reenviarA(PHP_API_URL, req, res);
});

// =========================================================================
// RUTAS HACIA API 2 (PYTHON): /proyectos, /postulaciones
// =========================================================================
app.post('/proyectos', (req, res) => {
    const body = { ...(req.body || {}) };
    if (body.cliente_id === undefined && body.usuario_id === undefined && req.usuario && req.usuario.rol === 'CLIENTE') {
        body.cliente_id = req.usuario.id;
    }
    return reenviarA(PYTHON_API_URL, req, res, body);
});

app.post('/proyectos/:id/postulaciones', (req, res) => {
    const body = { ...(req.body || {}) };
    if (body.trabajador_id === undefined && body.usuario_id === undefined && req.usuario && req.usuario.rol === 'TRABAJADOR') {
        body.trabajador_id = req.usuario.id;
    }
    return reenviarA(PYTHON_API_URL, req, res, body);
});

// Orquestación: al aceptar una postulación en Python, crea automáticamente la asignación en Express
app.patch('/postulaciones/:id', async (req, res) => {
    try {
        const body = req.body || {};
        const resPython = await llamarMicroservicio(
            PYTHON_API_URL,
            'PATCH',
            `/postulaciones/${req.params.id}`,
            { estado: body.estado }
        );

        if (resPython.status !== 200 || !resPython.data) {
            return res.status(resPython.status).json(resPython.data);
        }

        const postulacion = resPython.data;
        if (postulacion.estado === 'ACEPTADA' && body.crear_asignacion !== false) {
            try {
                const resAsignacion = await llamarMicroservicio(EXPRESS_API_URL, 'POST', '/asignaciones', {
                    trabajador_id: postulacion.trabajador_id,
                    proyecto_id: postulacion.proyecto_id,
                    rol_en_proyecto: body.rol_en_proyecto || 'Freelancer',
                    tarifa_por_hora: Number(postulacion.tarifa_propuesta)
                });
                if (resAsignacion.status === 201) {
                    postulacion.asignacion_id = resAsignacion.data.id;
                }
            } catch (errExpress) {
                console.warn('No se pudo crear automáticamente la asignación en Express:', errExpress.message);
            }
        }

        return res.status(200).json(postulacion);
    } catch (error) {
        console.error('Error en PATCH /postulaciones/:id (Gateway):', error.message);
        return res.status(502).json({
            status: 'error',
            message: 'El servicio de proyectos (Python) no está disponible'
        });
    }
});

app.use(['/proyectos', '/postulaciones'], (req, res) => {
    return reenviarA(PYTHON_API_URL, req, res);
});

// =========================================================================
// RUTAS HACIA API 3 (EXPRESS): /asignaciones, /registros-tiempo, /facturas
// =========================================================================
app.post('/facturas', (req, res) => {
    const body = { ...(req.body || {}) };
    if (body.trabajador_id === undefined && body.idUsuario === undefined && req.usuario && req.usuario.rol === 'TRABAJADOR') {
        body.trabajador_id = req.usuario.id;
    }
    return reenviarA(EXPRESS_API_URL, req, res, body);
});

app.use(['/asignaciones', '/registros-tiempo', '/facturas'], (req, res) => {
    return reenviarA(EXPRESS_API_URL, req, res);
});

// =========================================================================
// RUTA NO ENCONTRADA EN EL GATEWAY
// =========================================================================
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Ruta '${req.originalUrl}' no encontrada en el API Gateway`
    });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`API Gateway corriendo en http://localhost:${PORT}`);
    });
}

module.exports = app;
