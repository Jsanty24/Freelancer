require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const FRONTEND_DIR = path.resolve(__dirname, '../../Frontend');
app.use('/app', express.static(FRONTEND_DIR));
app.use(express.static(FRONTEND_DIR));
app.get('/', (req, res) => {
    res.redirect('/app/index.html');
});

const PORT = Number(process.env.PORT) || 4000;
const PHP_API_URL = (process.env.PHP_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const PYTHON_API_URL = (process.env.PYTHON_API_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');
const EXPRESS_API_URL = (process.env.EXPRESS_API_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const INTERNAL_API_KEY = (process.env.INTERNAL_API_KEY || '').trim();
const JWT_SECRET = (process.env.JWT_SECRET || '').trim();
const JWT_EXPIRES_SECONDS = Number(process.env.JWT_EXPIRES_SECONDS) || 86400;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_LOGIN_CONFIGURED =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN_EMAIL) &&
    ADMIN_PASSWORD.length >= 16;

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

function exigirAdmin(req, res, next) {
    if (!req.usuario) {
        return res.status(401).json({
            status: 'error',
            message: 'Inicia sesión para acceder a este recurso.'
        });
    }
    if (req.usuario.rol !== 'ADMIN') {
        return res.status(403).json({
            status: 'error',
            message: 'Este recurso está reservado para administradores.'
        });
    }
    next();
}

function exigirRoles(...roles) {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                status: 'error',
                message: 'Inicia sesión para acceder a este recurso.'
            });
        }
        if (!roles.includes(req.usuario.rol)) {
            return res.status(403).json({
                status: 'error',
                message: 'Tu cuenta no tiene permisos para realizar esta acción.'
            });
        }
        next();
    };
}

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

async function reenviarA(baseUrl, req, res, bodyOverride = undefined, pathOverride = req.originalUrl) {
    try {
        const bodyAEnviar = bodyOverride !== undefined
            ? bodyOverride
            : (['GET', 'HEAD'].includes(req.method) ? undefined : req.body);

        const resultado = await llamarMicroservicio(baseUrl, req.method, pathOverride, bodyAEnviar);
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

async function obtenerProyectosCliente(clienteId, res) {
    const proyectos = [];
    let offset = 0;
    let total = 0;

    try {
        do {
            const pagina = await llamarMicroservicio(
                PYTHON_API_URL,
                'GET',
                `/proyectos?cliente=${clienteId}&limit=100&offset=${offset}`
            );
            if (pagina.status !== 200 || !pagina.data || !Array.isArray(pagina.data.items)) {
                res.status(pagina.status).json(pagina.data);
                return null;
            }
            if (pagina.data.items.length === 0) {
                break;
            }
            proyectos.push(...pagina.data.items);
            total = Number(pagina.data.total) || 0;
            offset += pagina.data.items.length;
        } while (offset < total);
        return proyectos;
    } catch (error) {
        console.error(`Error consultando proyectos del cliente ${clienteId}:`, error.message);
        res.status(502).json({
            status: 'error',
            message: 'El servicio de proyectos (Python) no está disponible'
        });
        return null;
    }
}

async function obtenerAsignacionesPropias(req, res) {
    if (req.usuario.rol === 'TRABAJADOR') {
        try {
            const resultado = await llamarMicroservicio(
                EXPRESS_API_URL,
                'GET',
                `/asignaciones?trabajador_id=${req.usuario.id}`
            );
            if (resultado.status !== 200) {
                res.status(resultado.status).json(resultado.data);
                return null;
            }
            return resultado.data.data;
        } catch (error) {
            console.error('Error consultando asignaciones del trabajador:', error.message);
            res.status(502).json({ status: 'error', message: 'El servicio de asignaciones no está disponible' });
            return null;
        }
    }
    if (req.usuario.rol !== 'CLIENTE') {
        return [];
    }

    const proyectos = await obtenerProyectosCliente(req.usuario.id, res);
    if (proyectos === null) {
        return null;
    }
    try {
        const resultados = await Promise.all(proyectos.map(proyecto =>
            llamarMicroservicio(EXPRESS_API_URL, 'GET', `/asignaciones?proyecto_id=${proyecto.id}`)
        ));
        const fallo = resultados.find(resultado => resultado.status !== 200);
        if (fallo) {
            res.status(fallo.status).json(fallo.data);
            return null;
        }
        return resultados.flatMap(resultado => resultado.data.data);
    } catch (error) {
        console.error('Error consultando asignaciones del cliente:', error.message);
        res.status(502).json({ status: 'error', message: 'El servicio de asignaciones no está disponible' });
        return null;
    }
}

async function autorizarAsignacionPorId(req, res, asignacionId, rolesPermitidos) {
    if (!req.usuario) {
        res.status(401).json({ status: 'error', message: 'Inicia sesión para acceder a este recurso.' });
        return null;
    }
    if (req.usuario.rol === 'ADMIN') {
        return true;
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
        res.status(403).json({ status: 'error', message: 'Tu cuenta no tiene permisos para realizar esta acción.' });
        return null;
    }

    try {
        const resultado = await llamarMicroservicio(
            EXPRESS_API_URL,
            'GET',
            `/asignaciones/${asignacionId}`
        );
        if (resultado.status !== 200 || !resultado.data || !resultado.data.data) {
            res.status(resultado.status).json(resultado.data);
            return null;
        }
        const asignacion = resultado.data.data;

        if (req.usuario.rol === 'TRABAJADOR' && Number(asignacion.trabajador_id) === req.usuario.id) {
            return true;
        }
        if (req.usuario.rol === 'CLIENTE') {
            const proyecto = await llamarMicroservicio(
                PYTHON_API_URL,
                'GET',
                `/proyectos/${asignacion.proyecto_id}`
            );
            if (proyecto.status !== 200 || !proyecto.data) {
                res.status(proyecto.status).json(proyecto.data);
                return null;
            }
            if (Number(proyecto.data.cliente_id) === req.usuario.id) {
                return true;
            }
        }
        res.status(403).json({ status: 'error', message: 'No tienes acceso a esta asignación.' });
        return null;
    } catch (error) {
        console.error(`Error verificando la asignación ${asignacionId}:`, error.message);
        res.status(502).json({ status: 'error', message: 'No se pudo verificar el acceso a la asignación.' });
        return null;
    }
}

async function autorizarAsignacion(req, res, rolesPermitidos) {
    return autorizarAsignacionPorId(req, res, req.params.id, rolesPermitidos);
}

async function autorizarRegistroTiempo(req, res, rolesPermitidos) {
    if (!req.usuario) {
        res.status(401).json({ status: 'error', message: 'Inicia sesión para acceder a este recurso.' });
        return null;
    }
    if (req.usuario.rol === 'ADMIN') {
        return true;
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
        res.status(403).json({ status: 'error', message: 'Tu cuenta no tiene permisos para realizar esta acción.' });
        return null;
    }

    try {
        const resRegistro = await llamarMicroservicio(
            EXPRESS_API_URL,
            'GET',
            `/registros-tiempo/${req.params.id}`
        );
        if (resRegistro.status !== 200 || !resRegistro.data || !resRegistro.data.data) {
            res.status(resRegistro.status).json(resRegistro.data);
            return null;
        }
        const registro = resRegistro.data.data;
        return await autorizarAsignacionPorId(req, res, registro.asignacion_id, rolesPermitidos);
    } catch (error) {
        console.error(`Error verificando el registro de tiempo ${req.params.id}:`, error.message);
        res.status(502).json({ status: 'error', message: 'No se pudo verificar el acceso al registro de tiempo.' });
        return null;
    }
}

async function autorizarFactura(req, res, rolesPermitidos) {
    if (!req.usuario) {
        res.status(401).json({ status: 'error', message: 'Inicia sesión para acceder a este recurso.' });
        return null;
    }
    if (req.usuario.rol === 'ADMIN') {
        return true;
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
        res.status(403).json({ status: 'error', message: 'Tu cuenta no tiene permisos para realizar esta acción.' });
        return null;
    }

    try {
        const resFactura = await llamarMicroservicio(
            EXPRESS_API_URL,
            'GET',
            `/facturas/${req.params.id}`
        );
        if (resFactura.status !== 200 || !resFactura.data || !resFactura.data.data) {
            res.status(resFactura.status).json(resFactura.data);
            return null;
        }
        const factura = resFactura.data.data;

        if (req.usuario.rol === 'CLIENTE' && Number(factura.cliente_id) === req.usuario.id) {
            return true;
        }
        if (req.usuario.rol === 'TRABAJADOR' && Number(factura.trabajador_id) === req.usuario.id) {
            return true;
        }

        res.status(403).json({ status: 'error', message: 'No tienes acceso a esta factura.' });
        return null;
    } catch (error) {
        console.error(`Error verificando la factura ${req.params.id}:`, error.message);
        res.status(502).json({ status: 'error', message: 'No se pudo verificar el acceso a la factura.' });
        return null;
    }
}

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

function esCredencialAdmin(email, password) {
    if (!ADMIN_LOGIN_CONFIGURED || typeof email !== 'string' || typeof password !== 'string') {
        return false;
    }

    const contrasenaRecibida = Buffer.from(password);
    const contrasenaConfigurada = Buffer.from(ADMIN_PASSWORD);
    return email.toLowerCase().trim() === ADMIN_EMAIL &&
        contrasenaRecibida.length === contrasenaConfigurada.length &&
        crypto.timingSafeEqual(contrasenaRecibida, contrasenaConfigurada);
}

function generarSesionAdmin() {
    const adminUser = {
        id: 0,
        nombre: 'Administrador',
        email: ADMIN_EMAIL,
        telefono: null,
        rol: 'ADMIN',
        fecha_registro: new Date().toISOString(),
        perfil: {
            cargo: 'Administrador de la plataforma'
        }
    };
    const token = firmarJWT({
        sub: '0',
        rol: 'ADMIN',
        nombre: adminUser.nombre,
        email: adminUser.email
    });
    return {
        status: 'success',
        message: 'Acceso de Administrador autorizado',
        token,
        usuario: adminUser
    };
}

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

app.post('/auth/admin-login', (req, res) => {
    if (!ADMIN_LOGIN_CONFIGURED) {
        return res.status(503).json({
            status: 'error',
            message: 'El acceso de administrador no está configurado. Define ADMIN_EMAIL y una ADMIN_PASSWORD de al menos 16 caracteres en el archivo .env del Gateway.'
        });
    }

    const { email, password } = req.body || {};
    if (esCredencialAdmin(email, password)) {
        return res.status(200).json(generarSesionAdmin());
    }
    return res.status(401).json({
        status: 'error',
        message: 'Correo o contraseña de administrador incorrectos.'
    });
});

app.post('/auth/login', manejarLogin);
app.post('/login', manejarLogin);

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
    if (req.usuario.rol === 'ADMIN') {
        return res.json({
            status: 'success',
            data: {
                id: req.usuario.id,
                nombre: req.usuario.nombre,
                email: req.usuario.email,
                rol: req.usuario.rol
            }
        });
    }

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

app.use(['/usuarios', '/clientes'], exigirAdmin, (req, res) => {
    return reenviarA(PHP_API_URL, req, res);
});

app.get('/trabajadores', async (req, res) => {
    try {
        const resultado = await llamarMicroservicio(PHP_API_URL, 'GET', '/trabajadores');
        if (resultado.status !== 200 || !resultado.data || !Array.isArray(resultado.data.data)) {
            return res.status(resultado.status).json(resultado.data);
        }
        const data = resultado.data.data.map(({ email, telefono, fecha_registro, ...perfil }) => perfil);
        return res.json({ ...resultado.data, data });
    } catch (error) {
        console.error('Error cargando el directorio de talento:', error.message);
        return res.status(502).json({
            status: 'error',
            message: 'El servicio de usuarios (PHP) no está disponible'
        });
    }
});
app.get('/trabajadores/:id', exigirAutenticacion, (req, res, next) => {
    if (req.usuario.rol !== 'ADMIN' && req.usuario.id !== Number(req.params.id)) {
        return res.status(403).json({ status: 'error', message: 'No puedes consultar el perfil privado de otro usuario.' });
    }
    return reenviarA(PHP_API_URL, req, res);
});
app.use('/trabajadores', exigirAdmin, (req, res) => reenviarA(PHP_API_URL, req, res));

app.use('/proyectos/:id', (req, res, next) => {
    if (['PATCH', 'DELETE'].includes(req.method)) {
        return exigirAdmin(req, res, next);
    }
    next();
});

app.post('/proyectos', exigirRoles('CLIENTE'), (req, res) => {
    const body = { ...(req.body || {}) };
    body.cliente_id = req.usuario.id;
    delete body.usuario_id;
    return reenviarA(PYTHON_API_URL, req, res, body);
});

app.post('/proyectos/:id/postulaciones', exigirRoles('TRABAJADOR'), (req, res) => {
    const body = { ...(req.body || {}) };
    body.trabajador_id = req.usuario.id;
    delete body.usuario_id;
    return reenviarA(PYTHON_API_URL, req, res, body);
});

app.get('/postulaciones', exigirRoles('TRABAJADOR', 'CLIENTE', 'ADMIN'), async (req, res) => {
    try {
        const resultado = await llamarMicroservicio(PYTHON_API_URL, 'GET', '/postulaciones');
        if (resultado.status !== 200 || !Array.isArray(resultado.data)) {
            return res.status(resultado.status).json(resultado.data);
        }
        if (req.usuario.rol === 'ADMIN') {
            return res.json(resultado.data);
        }
        if (req.usuario.rol === 'TRABAJADOR') {
            return res.json(resultado.data.filter(post => Number(post.trabajador_id) === req.usuario.id));
        }

        const postulaciones = resultado.data;
        const proyectosPropios = new Set();
        let offset = 0;
        let total = 0;
        do {
            const pagina = await llamarMicroservicio(
                PYTHON_API_URL,
                'GET',
                `/proyectos?cliente=${req.usuario.id}&limit=100&offset=${offset}`
            );
            if (pagina.status !== 200 || !pagina.data || !Array.isArray(pagina.data.items)) {
                return res.status(pagina.status).json(pagina.data);
            }
            pagina.data.items.forEach(proyecto => proyectosPropios.add(Number(proyecto.id)));
            total = Number(pagina.data.total) || 0;
            offset += pagina.data.items.length;
        } while (offset < total && offset > 0);
        return res.json(postulaciones.filter(post => proyectosPropios.has(Number(post.proyecto_id))));
    } catch (error) {
        console.error('Error cargando postulaciones:', error.message);
        return res.status(502).json({
            status: 'error',
            message: 'El servicio de proyectos (Python) no está disponible'
        });
    }
});

app.get('/proyectos/:id/postulaciones', exigirRoles('TRABAJADOR', 'CLIENTE', 'ADMIN'), async (req, res) => {
    try {
        const proyecto = await llamarMicroservicio(PYTHON_API_URL, 'GET', `/proyectos/${req.params.id}`);
        if (proyecto.status !== 200 || !proyecto.data) {
            return res.status(proyecto.status).json(proyecto.data);
        }
        if (req.usuario.rol === 'CLIENTE' && Number(proyecto.data.cliente_id) !== req.usuario.id) {
            return res.status(403).json({ status: 'error', message: 'No puedes ver las propuestas de otro cliente.' });
        }
        const resultado = await llamarMicroservicio(
            PYTHON_API_URL,
            'GET',
            `/proyectos/${req.params.id}/postulaciones`
        );
        if (resultado.status !== 200 || !Array.isArray(resultado.data)) {
            return res.status(resultado.status).json(resultado.data);
        }
        if (req.usuario.rol === 'TRABAJADOR') {
            return res.json(resultado.data.filter(post => Number(post.trabajador_id) === req.usuario.id));
        }
        return res.json(resultado.data);
    } catch (error) {
        console.error(`Error cargando propuestas del proyecto ${req.params.id}:`, error.message);
        return res.status(502).json({
            status: 'error',
            message: 'El servicio de proyectos (Python) no está disponible'
        });
    }
});

app.patch('/postulaciones/:id', exigirRoles('CLIENTE', 'ADMIN'), async (req, res) => {
    try {
        const body = req.body || {};
        if (req.usuario.rol !== 'ADMIN') {
            const resultadoPostulaciones = await llamarMicroservicio(PYTHON_API_URL, 'GET', '/postulaciones');
            if (resultadoPostulaciones.status !== 200 || !Array.isArray(resultadoPostulaciones.data)) {
                return res.status(resultadoPostulaciones.status).json(resultadoPostulaciones.data);
            }
            const postulacion = resultadoPostulaciones.data.find(post => Number(post.id) === Number(req.params.id));
            if (!postulacion) {
                return res.status(404).json({ status: 'error', message: 'Postulación no encontrada.' });
            }
            const proyecto = await llamarMicroservicio(
                PYTHON_API_URL,
                'GET',
                `/proyectos/${postulacion.proyecto_id}`
            );
            if (proyecto.status !== 200 || !proyecto.data) {
                return res.status(proyecto.status).json(proyecto.data);
            }
            if (Number(proyecto.data.cliente_id) !== req.usuario.id) {
                return res.status(403).json({ status: 'error', message: 'Solo el cliente propietario puede responder a esta propuesta.' });
            }
        }
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
                } else {
                    console.error(
                        `Postulación ${postulacion.id} fue aceptada, pero la asignación no se creó (HTTP ${resAsignacion.status}).`
                    );
                    return res.status(502).json({
                        status: 'error',
                        message: 'La propuesta fue aceptada, pero no se pudo crear su asignación. Revisa el estado antes de volver a intentarlo.'
                    });
                }
            } catch (errExpress) {
                console.error('La propuesta fue aceptada, pero falló la creación de su asignación:', errExpress.message);
                return res.status(502).json({
                    status: 'error',
                    message: 'La propuesta fue aceptada, pero no se pudo conectar con el servicio de asignaciones. Revisa el estado antes de volver a intentarlo.'
                });
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
// FACTURAS (GATEWAY -> EXPRESS)
// =========================================================================
app.use('/facturas', exigirAutenticacion);

app.get('/facturas', async (req, res) => {
    const url = new URL(req.originalUrl, 'http://localhost');
    if (req.usuario.rol === 'CLIENTE') {
        url.searchParams.set('cliente_id', String(req.usuario.id));
        url.searchParams.delete('trabajador_id');
    } else if (req.usuario.rol === 'TRABAJADOR') {
        url.searchParams.set('trabajador_id', String(req.usuario.id));
        url.searchParams.delete('cliente_id');
    }
    return reenviarA(EXPRESS_API_URL, req, res, undefined, url.pathname + url.search);
});

app.post('/facturas', exigirRoles('TRABAJADOR', 'ADMIN'), (req, res) => {
    const body = { ...(req.body || {}) };
    if (req.usuario.rol === 'TRABAJADOR') {
        body.trabajador_id = req.usuario.id;
        delete body.idUsuario;
    }
    return reenviarA(EXPRESS_API_URL, req, res, body);
});

app.get('/facturas/:id', exigirRoles('TRABAJADOR', 'CLIENTE', 'ADMIN'), async (req, res) => {
    if (await autorizarFactura(req, res, ['TRABAJADOR', 'CLIENTE']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

app.patch(['/facturas/:id/estado', '/facturas/:id'], exigirRoles('CLIENTE', 'ADMIN'), async (req, res) => {
    if (await autorizarFactura(req, res, ['CLIENTE']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

app.delete('/facturas/:id', exigirRoles('CLIENTE', 'ADMIN'), async (req, res) => {
    if (await autorizarFactura(req, res, ['CLIENTE']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

// =========================================================================
// ASIGNACIONES Y TEMPORIZADOR (GATEWAY -> EXPRESS)
// =========================================================================
app.get('/asignaciones', exigirRoles('TRABAJADOR', 'CLIENTE', 'ADMIN'), async (req, res) => {
    if (req.usuario.rol === 'ADMIN') {
        return reenviarA(EXPRESS_API_URL, req, res);
    }
    const asignaciones = await obtenerAsignacionesPropias(req, res);
    if (asignaciones === null) {
        return;
    }
    return res.json({ status: 'success', data: asignaciones });
});

app.get('/asignaciones/:id', exigirRoles('TRABAJADOR', 'CLIENTE', 'ADMIN'), async (req, res) => {
    if (await autorizarAsignacion(req, res, ['TRABAJADOR', 'CLIENTE']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

app.post('/asignaciones', exigirRoles('CLIENTE', 'ADMIN'), async (req, res) => {
    if (req.usuario.rol === 'ADMIN') {
        return reenviarA(EXPRESS_API_URL, req, res);
    }
    const proyectoId = Number(req.body?.proyecto_id);
    if (!Number.isSafeInteger(proyectoId) || proyectoId <= 0) {
        return res.status(400).json({ status: 'error', message: 'Selecciona un proyecto válido.' });
    }
    try {
        const proyecto = await llamarMicroservicio(PYTHON_API_URL, 'GET', `/proyectos/${proyectoId}`);
        if (proyecto.status !== 200 || !proyecto.data) {
            return res.status(proyecto.status).json(proyecto.data);
        }
        if (Number(proyecto.data.cliente_id) !== req.usuario.id) {
            return res.status(403).json({ status: 'error', message: 'Solo el cliente propietario puede crear una asignación.' });
        }
        return reenviarA(EXPRESS_API_URL, req, res);
    } catch (error) {
        console.error('Error verificando la propiedad del proyecto:', error.message);
        return res.status(502).json({ status: 'error', message: 'No se pudo verificar el proyecto.' });
    }
});

app.get('/asignaciones/:id/registros-tiempo', exigirRoles('TRABAJADOR', 'CLIENTE', 'ADMIN'), async (req, res) => {
    if (await autorizarAsignacion(req, res, ['TRABAJADOR', 'CLIENTE']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

app.get(['/asignaciones/:id/valor', '/asignaciones/:id/resumen', '/asignaciones/:id/calcular-valor'], exigirRoles('TRABAJADOR', 'CLIENTE', 'ADMIN'), async (req, res) => {
    if (await autorizarAsignacion(req, res, ['TRABAJADOR', 'CLIENTE']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

app.post(['/asignaciones/:id/registros-tiempo', '/asignaciones/:id/horas', '/asignaciones/:id/horas-manuales'], exigirRoles('TRABAJADOR', 'ADMIN'), async (req, res) => {
    if (await autorizarAsignacion(req, res, ['TRABAJADOR']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

app.post(['/asignaciones/:id/temporizador', '/asignaciones/:id/iniciar-temporizador', '/asignaciones/:id/detener-temporizador'], exigirRoles('TRABAJADOR', 'ADMIN'), async (req, res) => {
    if (await autorizarAsignacion(req, res, ['TRABAJADOR']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

app.delete('/asignaciones/:id/temporizador', exigirRoles('TRABAJADOR', 'ADMIN'), async (req, res) => {
    if (await autorizarAsignacion(req, res, ['TRABAJADOR']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

app.patch(['/asignaciones/:id/temporizador', '/asignaciones/:id/iniciar-temporizador', '/asignaciones/:id/detener-temporizador'], exigirRoles('TRABAJADOR', 'ADMIN'), async (req, res) => {
    if (await autorizarAsignacion(req, res, ['TRABAJADOR']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

app.patch('/asignaciones/:id', exigirRoles('CLIENTE', 'ADMIN'), async (req, res) => {
    if (await autorizarAsignacion(req, res, ['CLIENTE']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

app.delete('/asignaciones/:id', exigirRoles('CLIENTE', 'ADMIN'), async (req, res) => {
    if (await autorizarAsignacion(req, res, ['CLIENTE']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

// =========================================================================
// REGISTROS DE TIEMPO (GATEWAY -> EXPRESS)
// =========================================================================
app.get('/registros-tiempo', exigirRoles('TRABAJADOR', 'CLIENTE', 'ADMIN'), async (req, res) => {
    if (req.usuario.rol === 'ADMIN') {
        return reenviarA(EXPRESS_API_URL, req, res);
    }
    const asignaciones = await obtenerAsignacionesPropias(req, res);
    if (asignaciones === null) {
        return;
    }
    try {
        const resultados = await Promise.all(asignaciones.map(asignacion =>
            llamarMicroservicio(EXPRESS_API_URL, 'GET', `/asignaciones/${asignacion.id}/registros-tiempo`)
        ));
        const fallo = resultados.find(resultado => resultado.status !== 200);
        if (fallo) {
            return res.status(fallo.status).json(fallo.data);
        }
        let registros = resultados.flatMap(resultado => resultado.data.data);
        if (req.query.asignacion_id !== undefined) {
            registros = registros.filter(r => Number(r.asignacion_id) === Number(req.query.asignacion_id));
        }
        if (req.query.estado !== undefined) {
            const estadoFiltro = String(req.query.estado).toUpperCase();
            registros = registros.filter(r => String(r.estado).toUpperCase() === estadoFiltro);
        }
        if (req.query.factura_id !== undefined) {
            registros = registros.filter(r => Number(r.factura_id) === Number(req.query.factura_id));
        }
        return res.json({
            status: 'success',
            data: registros
        });
    } catch (error) {
        console.error('Error consultando registros de tiempo:', error.message);
        return res.status(502).json({ status: 'error', message: 'El servicio de registros de tiempo no está disponible' });
    }
});

app.post('/registros-tiempo', exigirRoles('TRABAJADOR', 'ADMIN'), async (req, res) => {
    const asignacionId = Number(req.body?.asignacion_id);
    if (!Number.isSafeInteger(asignacionId) || asignacionId <= 0) {
        return res.status(400).json({ status: 'error', message: 'El campo asignacion_id es obligatorio y debe ser numérico.' });
    }
    if (await autorizarAsignacionPorId(req, res, asignacionId, ['TRABAJADOR']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

app.get('/registros-tiempo/:id', exigirRoles('TRABAJADOR', 'CLIENTE', 'ADMIN'), async (req, res) => {
    if (await autorizarRegistroTiempo(req, res, ['TRABAJADOR', 'CLIENTE']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

app.patch(['/registros-tiempo/:id/aprobar', '/registros-tiempo/:id/estado', '/registros-tiempo/:id'], exigirRoles('CLIENTE', 'ADMIN'), async (req, res) => {
    if (await autorizarRegistroTiempo(req, res, ['CLIENTE']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

app.delete('/registros-tiempo/:id', exigirRoles('TRABAJADOR', 'ADMIN'), async (req, res) => {
    if (await autorizarRegistroTiempo(req, res, ['TRABAJADOR']) === null) {
        return;
    }
    return reenviarA(EXPRESS_API_URL, req, res);
});

app.use('/asignaciones', exigirAdmin, (req, res) => reenviarA(EXPRESS_API_URL, req, res));
app.use('/registros-tiempo', exigirAdmin, (req, res) => reenviarA(EXPRESS_API_URL, req, res));

app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Ruta '${req.originalUrl}' no encontrada en el API Gateway`
    });
});

if (require.main === module) {
    if (INTERNAL_API_KEY.length < 32) {
        throw new Error('Configura INTERNAL_API_KEY con al menos 32 caracteres en el archivo .env del Gateway.');
    }
    if (JWT_SECRET.length < 32) {
        throw new Error('Configura JWT_SECRET con al menos 32 caracteres en el archivo .env del Gateway.');
    }
    if (!ADMIN_LOGIN_CONFIGURED) {
        console.warn('Acceso administrador deshabilitado: configura ADMIN_EMAIL y una ADMIN_PASSWORD de al menos 16 caracteres.');
    }

    app.listen(PORT, () => {
        console.log(`API Gateway corriendo en http://localhost:${PORT}`);
    });
}

module.exports = app;
