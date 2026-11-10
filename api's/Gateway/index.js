require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');

const app = express();
app.disable('x-powered-by');
const ORIGENES_PERMITIDOS = new Set([
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'capacitor://localhost',
    'http://localhost'
]);
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || ORIGENES_PERMITIDOS.has(origin)) {
            return callback(null, origin || true);
        }
        return callback(null, false);
    },
    credentials: true,
    exposedHeaders: [
        'X-CSRF-Token',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset'
    ]
}));
app.use(express.json({ limit: '100kb' }));

// =========================================================================
// FLUJO DE AUTENTICACIÓN CON TOKENS ROTATIVOS + COOKIES HTTPONLY (SIN EXPOSICIÓN EN BODY NI CABECERAS)
// =========================================================================
const COOKIE_ACCESS_TOKEN = 'freelancer_access_token';
const COOKIE_REFRESH_TOKEN = 'freelancer_refresh_token';
const COOKIE_CSRF_TOKEN = 'freelancer_csrf_token';

function parsearCookies(req) {
    const lista = {};
    const headerCookie = req && req.headers ? req.headers.cookie : '';
    if (!headerCookie) return lista;
    for (const par of String(headerCookie).split(';')) {
        const idx = par.indexOf('=');
        if (idx < 0) continue;
        const clave = par.slice(0, idx).trim();
        const valor = par.slice(idx + 1).trim();
        if (!clave) continue;
        try {
            lista[clave] = decodeURIComponent(valor);
        } catch {
            lista[clave] = valor;
        }
    }
    // Soportar prefijo __Host- en producción HTTPS de forma transparente
    if (lista[`__Host-${COOKIE_ACCESS_TOKEN}`] && !lista[COOKIE_ACCESS_TOKEN]) {
        lista[COOKIE_ACCESS_TOKEN] = lista[`__Host-${COOKIE_ACCESS_TOKEN}`];
    }
    if (lista[`__Host-${COOKIE_REFRESH_TOKEN}`] && !lista[COOKIE_REFRESH_TOKEN]) {
        lista[COOKIE_REFRESH_TOKEN] = lista[`__Host-${COOKIE_REFRESH_TOKEN}`];
    }
    if (lista[`__Host-${COOKIE_CSRF_TOKEN}`] && !lista[COOKIE_CSRF_TOKEN]) {
        lista[COOKIE_CSRF_TOKEN] = lista[`__Host-${COOKIE_CSRF_TOKEN}`];
    }
    return lista;
}

function esConexionSegura(req) {
    if (process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE_COOKIES === 'true') {
        return true;
    }
    if (!req) return false;
    return Boolean(req.secure || String(req.headers?.['x-forwarded-proto'] || '').toLowerCase() === 'https');
}

function establecerCookiesAuthHttpOnly(res, parTokens, req = null) {
    if (!res || !parTokens) return;
    const esHttps = esConexionSegura(req);
    const prefijo = esHttps ? '__Host-' : '';
    const secureFlag = esHttps ? '; Secure' : '';
    const maxAgeAccess = Number(parTokens.expires_in) || 180;
    const maxAgeRefresh = 28800;

    const cookies = [
        `${prefijo}${COOKIE_ACCESS_TOKEN}=${encodeURIComponent(parTokens.token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeAccess}${secureFlag}`,
        `${prefijo}${COOKIE_REFRESH_TOKEN}=${encodeURIComponent(parTokens.refresh_token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeRefresh}${secureFlag}`,
        `${prefijo}${COOKIE_CSRF_TOKEN}=${encodeURIComponent(parTokens.csrf_token || '')}; SameSite=Strict; Path=/; Max-Age=${maxAgeRefresh}${secureFlag}`
    ];
    res.setHeader('Set-Cookie', cookies);
}

function limpiarCookiesAuthHttpOnly(res, req = null) {
    if (!res) return;
    const esHttps = esConexionSegura(req);
    const prefijo = esHttps ? '__Host-' : '';
    const secureFlag = esHttps ? '; Secure' : '';
    res.setHeader('Set-Cookie', [
        `${prefijo}${COOKIE_ACCESS_TOKEN}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`,
        `${prefijo}${COOKIE_REFRESH_TOKEN}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`,
        `${prefijo}${COOKIE_CSRF_TOKEN}=; SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`
    ]);
}

/**
 * Elimina `token` y `refresh_token` del body JSON para que NUNCA sean legibles por JS (XSS).
 * Los tokens reales viajan exclusivamente dentro de las cookies HttpOnly.
 */
function sanitizarMetadatosSesionParaBody(parTokens) {
    if (!parTokens) return {};
    return {
        csrf_token: parTokens.csrf_token,
        rot: parTokens.rot || 1,
        expires_in: parTokens.expires_in || JWT_EXPIRES_SECONDS,
        rotation_interval_seconds: parTokens.rotation_interval_seconds || TOKEN_ROTATION_INTERVAL_SECONDS,
        rotated_at: parTokens.rotated_at || new Date().toISOString(),
        httponly_cookie: true
    };
}

// =========================================================================
// CAPA 1: CABECERAS DE SEGURIDAD OWASP / HELMET & CONTROL DE CACHÉ (SIN 'unsafe-inline' EN script-src)
// =========================================================================
function compararTiempoConstante(a, b) {
    const strA = String(a || '');
    const strB = String(b || '');
    if (!strA || !strB || strA.length !== strB.length) return false;
    return crypto.timingSafeEqual(Buffer.from(strA, 'utf8'), Buffer.from(strB, 'utf8'));
}

app.use((req, res, next) => {
    const esRecursoFrontend =
        req.path === '/' ||
        req.path.startsWith('/app') ||
        req.path.startsWith('/js/') ||
        req.path.startsWith('/css/') ||
        req.path.startsWith('/public/') ||
        req.path.endsWith('.html') ||
        req.path.endsWith('.css') ||
        req.path.endsWith('.js') ||
        req.path.endsWith('.svg');

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

    if (esRecursoFrontend) {
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' http://localhost:4000 http://127.0.0.1:4000; object-src 'none'; frame-ancestors 'none'; base-uri 'self';"
        );
    } else {
        // CSP estricto para respuestas JSON de la API (cero ejecución de scripts o recursos externos)
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'none'; script-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none';"
        );
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

const FRONTEND_DIR = path.resolve(__dirname, '../../Frontend');
app.use('/app', express.static(FRONTEND_DIR, { etag: false, maxAge: 0 }));
app.use(express.static(FRONTEND_DIR, { etag: false, maxAge: 0 }));
app.get('/', (req, res) => {
    res.redirect('/app/index.html');
});

const PORT = Number(process.env.PORT) || 4000;
const PHP_API_URL = (process.env.PHP_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const PYTHON_API_URL = (process.env.PYTHON_API_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');
const EXPRESS_API_URL = (process.env.EXPRESS_API_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const INTERNAL_API_KEY = (process.env.INTERNAL_API_KEY || '').trim();
const JWT_SECRET = (process.env.JWT_SECRET || '').trim();
const JWT_EXPIRES_SECONDS = Number(process.env.JWT_EXPIRES_SECONDS) || 180;
const TOKEN_ROTATION_INTERVAL_SECONDS = Number(process.env.TOKEN_ROTATION_INTERVAL_SECONDS) || 30;
const TOKEN_GRACE_PERIOD_SECONDS = 12;
const REFRESH_TOKEN_TTL_SECONDS = 28800; // 8 horas de sesión máxima con rotación constante
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_LOGIN_CONFIGURED =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN_EMAIL) &&
    ADMIN_PASSWORD.length >= 16;

// Registro en memoria de sesiones activas, tokens revocados, detección de robo y bitácora WAF
const sesionesActivas = new Map();
const tokensRevocados = new Map();
const refreshTokensUsados = new Map(); // hash -> { sid, usedAt } (detección de robo/reuso de refresh token)
const rateLimitPorIp = new Map();
const intentosLoginFallidos = new Map();
const eventosSeguridad = [];

function registrarEventoSeguridad(tipo, severidad, detalle, req = null) {
    const ip = req ? (req.ip || req.socket?.remoteAddress || '127.0.0.1') : 'sistema';
    eventosSeguridad.unshift({
        id: crypto.randomUUID().slice(0, 8),
        fecha: new Date().toISOString().slice(0, 19).replace('T', ' '),
        tipo,
        severidad, // 'INFO' | 'WARN' | 'CRITICO'
        ip,
        ruta: req ? `${req.method} ${req.originalUrl}` : '-',
        detalle
    });
    if (eventosSeguridad.length > 60) {
        eventosSeguridad.length = 60;
    }
}

function obtenerHuellaCliente(req) {
    if (!req) return 'internal';
    const ua = String(req.header('User-Agent') || 'unknown-agent').trim();
    return crypto.createHash('sha256').update(ua).digest('hex').slice(0, 16);
}

// =========================================================================
// CAPA 2: RATE LIMITING GLOBAL Y ANTI-FUERZA BRUTA
// =========================================================================
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQ = 240;
const LOGIN_MAX_INTENTOS = 5;
const LOGIN_BLOQUEO_MS = 5 * 60 * 1000;

app.use((req, res, next) => {
    if (req.path.startsWith('/app') || req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.svg')) {
        return next();
    }
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const ahoraMs = Date.now();
    let registro = rateLimitPorIp.get(ip);
    if (!registro || ahoraMs > registro.resetAt) {
        registro = { count: 0, resetAt: ahoraMs + RATE_LIMIT_WINDOW_MS };
        rateLimitPorIp.set(ip, registro);
    }
    registro.count += 1;
    const restantes = Math.max(0, RATE_LIMIT_MAX_REQ - registro.count);
    res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQ));
    res.setHeader('X-RateLimit-Remaining', String(restantes));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(registro.resetAt / 1000)));

    if (registro.count > RATE_LIMIT_MAX_REQ) {
        registrarEventoSeguridad('RATE_LIMIT_EXCEEDED', 'WARN', `Límite de ${RATE_LIMIT_MAX_REQ} req/min excedido`, req);
        return res.status(429).json({
            status: 'error',
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Demasiadas peticiones desde esta dirección IP. Espera unos segundos antes de reintentar.'
        });
    }
    next();
});

// =========================================================================
// CAPA 3: WAF LIGERO (ANTI-XSS, ANTI-SQLi, ANTI-PROTOTYPE POLLUTION)
// =========================================================================
const PATRONES_ATAQUE_WAF = [
    /<\s*script\b/i,
    /javascript\s*:/i,
    /\bon(?:error|load|mouseover|focus|click)\s*=/i,
    /<\s*(?:iframe|object|embed|svg\s+onload)\b/i,
    /\bUNION\s+ALL?\s+SELECT\b/i,
    /;\s*DROP\s+TABLE\b/i
];

function inspeccionarYSanitizarValor(valor) {
    if (typeof valor === 'string') {
        const limpio = valor.replace(/\0/g, '');
        for (const patron of PATRONES_ATAQUE_WAF) {
            if (patron.test(limpio)) {
                const err = new Error('Se detectó un patrón de inyección malicioso (XSS / SQLi) bloqueado por el WAF.');
                err.wafBlocked = true;
                throw err;
            }
        }
        return limpio;
    }
    if (Array.isArray(valor)) {
        return valor.map(inspeccionarYSanitizarValor);
    }
    if (valor && typeof valor === 'object') {
        const resultado = {};
        for (const [k, v] of Object.entries(valor)) {
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
                const err = new Error('Intento de contaminación de prototipo (Prototype Pollution) bloqueado.');
                err.wafBlocked = true;
                throw err;
            }
            resultado[k] = inspeccionarYSanitizarValor(v);
        }
        return resultado;
    }
    return valor;
}

app.use((req, res, next) => {
    try {
        if (req.body && typeof req.body === 'object') {
            req.body = inspeccionarYSanitizarValor(req.body);
        }
        if (req.query && typeof req.query === 'object') {
            req.query = inspeccionarYSanitizarValor(req.query);
        }
        next();
    } catch (err) {
        if (err.wafBlocked) {
            registrarEventoSeguridad('WAF_PAYLOAD_BLOCKED', 'CRITICO', err.message, req);
            return res.status(400).json({
                status: 'error',
                code: 'WAF_BLOCKED',
                message: err.message
            });
        }
        next(err);
    }
});

function limpiarTokensExpirados() {
    const ahora = Math.floor(Date.now() / 1000);
    for (const [jti, exp] of tokensRevocados.entries()) {
        if (ahora > exp + 60) {
            tokensRevocados.delete(jti);
        }
    }
    for (const [sid, sesion] of sesionesActivas.entries()) {
        if (ahora > sesion.expiresAt) {
            sesionesActivas.delete(sid);
        }
    }
    for (const [hash, info] of refreshTokensUsados.entries()) {
        if (ahora > info.usedAt + 3600) {
            refreshTokensUsados.delete(hash);
        }
    }
}
setInterval(limpiarTokensExpirados, 60000).unref();

function hashTokenOpaco(valor) {
    return crypto.createHash('sha256').update(String(valor || '')).digest('hex');
}

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

function firmarJWT(payloadObj, ttlSeconds = JWT_EXPIRES_SECONDS) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const ahora = Math.floor(Date.now() / 1000);
    const jti = payloadObj.jti || crypto.randomUUID();
    const sid = payloadObj.sid || crypto.randomUUID();
    const rot = Number(payloadObj.rot) || 1;
    const payload = {
        ...payloadObj,
        jti,
        sid,
        rot,
        iat: ahora,
        exp: ahora + ttlSeconds
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

function emitirParTokens(usuarioPayload, sesionExistente = null, req = null) {
    const ahora = Math.floor(Date.now() / 1000);
    const sid = sesionExistente ? sesionExistente.sid : crypto.randomUUID();
    const rot = sesionExistente ? (Number(sesionExistente.rotCount) || 1) + 1 : 1;
    const nuevoJti = crypto.randomUUID();
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const csrfToken = sesionExistente && sesionExistente.csrfToken
        ? sesionExistente.csrfToken
        : crypto.randomBytes(24).toString('hex');
    const fgp = sesionExistente && sesionExistente.fgp
        ? sesionExistente.fgp
        : obtenerHuellaCliente(req);

    if (sesionExistente) {
        if (sesionExistente.previousJti) {
            tokensRevocados.set(sesionExistente.previousJti, ahora + JWT_EXPIRES_SECONDS);
        }
        if (sesionExistente.refreshTokenHash) {
            refreshTokensUsados.set(sesionExistente.refreshTokenHash, {
                sid,
                usedAt: ahora
            });
        }
    }

    const sesion = {
        sid,
        userPayload: {
            sub: String(usuarioPayload.sub),
            rol: String(usuarioPayload.rol).toUpperCase(),
            nombre: usuarioPayload.nombre,
            email: usuarioPayload.email
        },
        currentJti: nuevoJti,
        previousJti: sesionExistente ? sesionExistente.currentJti : null,
        previousJtiValidUntil: sesionExistente ? (ahora + TOKEN_GRACE_PERIOD_SECONDS) : 0,
        refreshTokenHash: hashTokenOpaco(refreshToken),
        csrfToken,
        fgp,
        rotCount: rot,
        lastRotatedAt: ahora,
        createdAt: sesionExistente ? sesionExistente.createdAt : ahora,
        expiresAt: ahora + REFRESH_TOKEN_TTL_SECONDS
    };

    sesionesActivas.set(sid, sesion);

    const token = firmarJWT({
        ...sesion.userPayload,
        jti: nuevoJti,
        sid,
        rot,
        fgp
    }, JWT_EXPIRES_SECONDS);

    return {
        token,
        refresh_token: refreshToken,
        csrf_token: csrfToken,
        jti: nuevoJti,
        sid,
        rot,
        fgp,
        expires_in: JWT_EXPIRES_SECONDS,
        rotation_interval_seconds: TOKEN_ROTATION_INTERVAL_SECONDS,
        rotated_at: new Date(ahora * 1000).toISOString()
    };
}

function verificarJWT(token, req = null) {
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

    if (payload.jti && tokensRevocados.has(payload.jti)) {
        const err = new Error('El token fue revocado o reemplazado por rotación de seguridad');
        err.revoked = true;
        throw err;
    }

    // Verificar vinculación de dispositivo (Fingerprint Binding) si aplica
    if (req && payload.fgp && payload.fgp !== 'internal') {
        const fgpActual = obtenerHuellaCliente(req);
        if (payload.fgp !== fgpActual) {
            registrarEventoSeguridad('FINGERPRINT_MISMATCH', 'CRITICO', `Posible robo de token (JTI ${payload.jti}) desde otro cliente/navegador`, req);
            const err = new Error('Token bloqueado: la huella del dispositivo no coincide con la sesión original');
            err.revoked = true;
            throw err;
        }
    }

    if (payload.sid && sesionesActivas.has(payload.sid)) {
        const sesion = sesionesActivas.get(payload.sid);
        const esActual = payload.jti === sesion.currentJti;
        const enVentanaGracia = payload.jti === sesion.previousJti && ahora <= sesion.previousJtiValidUntil;
        if (!esActual && !enVentanaGracia) {
            tokensRevocados.set(payload.jti, ahora + JWT_EXPIRES_SECONDS);
            const err = new Error('Token antiguo invalidado tras rotación automática');
            err.revoked = true;
            throw err;
        }
    }

    return payload;
}

app.use((req, res, next) => {
    req.cookies = parsearCookies(req);
    const authHeader = req.header('Authorization') || '';
    const tokenDesdeHeader = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : '';
    const tokenDesdeCookieHttpOnly = req.cookies[COOKIE_ACCESS_TOKEN] || '';
    const candidatos = [];
    if (tokenDesdeCookieHttpOnly) candidatos.push({ valor: tokenDesdeCookieHttpOnly, origen: 'httponly_cookie' });
    if (tokenDesdeHeader && tokenDesdeHeader !== tokenDesdeCookieHttpOnly) {
        candidatos.push({ valor: tokenDesdeHeader, origen: 'bearer_header' });
    }

    if (candidatos.length > 0) {
        try {
            let payload = null;
            let origenToken = null;
            let ultimoError = null;
            for (const cand of candidatos) {
                try {
                    payload = verificarJWT(cand.valor, req);
                    origenToken = cand.origen;
                    break;
                } catch (e) {
                    ultimoError = e;
                }
            }
            if (!payload) {
                throw ultimoError || new Error('Token inválido');
            }
            const sesion = payload.sid ? sesionesActivas.get(payload.sid) : null;

            // Validar protección CSRF estricta (Double-Submit Cookie === X-CSRF-Token Header === Sesión) en POST/PUT/PATCH/DELETE
            if (
                sesion &&
                sesion.csrfToken &&
                ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase()) &&
                req.path !== '/auth/login' &&
                req.path !== '/login' &&
                req.path !== '/auth/admin-login' &&
                req.path !== '/auth/registro'
            ) {
                const csrfHeader = req.header('X-CSRF-Token') || '';
                const csrfCookie = req.cookies[COOKIE_CSRF_TOKEN] || '';

                if (origenToken === 'httponly_cookie') {
                    const headerCoincideCookie = csrfCookie ? compararTiempoConstante(csrfHeader, csrfCookie) : true;
                    const headerCoincideSesion = compararTiempoConstante(csrfHeader, sesion.csrfToken);
                    if (!csrfHeader || !headerCoincideCookie || !headerCoincideSesion) {
                        registrarEventoSeguridad('CSRF_MISMATCH', 'CRITICO', 'Fallo de validación Double-Submit CSRF (X-CSRF-Token vs Cookie freelancer_csrf_token)', req);
                        return res.status(403).json({
                            status: 'error',
                            code: 'CSRF_INVALID',
                            message: 'Petición rechazada por protección Anti-CSRF Double-Submit (X-CSRF-Token no coincide con la cookie CSRF).'
                        });
                    }
                } else if (csrfHeader && !compararTiempoConstante(csrfHeader, sesion.csrfToken)) {
                    registrarEventoSeguridad('CSRF_MISMATCH', 'CRITICO', 'Token CSRF inválido en operación de escritura', req);
                    return res.status(403).json({
                        status: 'error',
                        code: 'CSRF_INVALID',
                        message: 'Petición rechazada por protección Anti-CSRF (X-CSRF-Token inválido).'
                    });
                }
            }

            req.usuario = {
                id: Number(payload.sub),
                rol: payload.rol,
                nombre: payload.nombre,
                email: payload.email,
                jti: payload.jti,
                sid: payload.sid,
                rot: payload.rot || 1,
                fgp: payload.fgp || null,
                csrf_token: sesion ? sesion.csrfToken : null,
                auth_source: origenToken,
                httponly: Boolean(tokenDesdeCookieHttpOnly),
                iat: payload.iat,
                exp: payload.exp
            };

            if (sesion && sesion.csrfToken) {
                res.setHeader('X-CSRF-Token', sesion.csrfToken);
            }

            // Rotación automática transparente cuando el token cumple su ciclo de rotación (actualiza únicamente Cookies HttpOnly + X-CSRF-Token)
            const ahora = Math.floor(Date.now() / 1000);
            if (
                sesion &&
                payload.jti === sesion.currentJti &&
                req.path !== '/auth/refresh' &&
                req.path !== '/auth/logout' &&
                (ahora - (sesion.lastRotatedAt || payload.iat || ahora)) >= TOKEN_ROTATION_INTERVAL_SECONDS
            ) {
                const nuevoPar = emitirParTokens(sesion.userPayload, sesion, req);
                establecerCookiesAuthHttpOnly(res, nuevoPar, req);
                res.setHeader('X-CSRF-Token', nuevoPar.csrf_token);
                registrarEventoSeguridad('TOKEN_AUTO_ROTATED', 'INFO', `Rotación automática en vuelo #${nuevoPar.rot} en Cookie HttpOnly (${sesion.userPayload.email})`, req);
            }
        } catch (err) {
            // Si la petición es a un endpoint público de autenticación (/auth/login, /auth/refresh, /health), ignorar cookie expirada
            if (
                req.path === '/health' ||
                req.path === '/login' ||
                req.path === '/auth/login' ||
                req.path === '/auth/admin-login' ||
                req.path === '/auth/registro' ||
                req.path === '/auth/refresh' ||
                req.path === '/auth/logout'
            ) {
                return next();
            }
            registrarEventoSeguridad('AUTH_TOKEN_REJECTED', 'WARN', err.message, req);
            return res.status(401).json({
                status: 'error',
                code: err.expired ? 'TOKEN_EXPIRED' : (err.revoked ? 'TOKEN_ROTATED' : 'TOKEN_INVALID'),
                message: err.expired
                    ? 'El token ha expirado'
                    : (err.revoked ? 'El token ya fue rotado o revocado por seguridad' : 'Token inválido')
            });
        }
    }
    next();
});

function exigirAutenticacion(req, res, next) {
    if (!req.usuario) {
        return res.status(401).json({
            status: 'error',
            message: 'Falta el token de autenticación. Inicia sesión para recibir la Cookie HttpOnly o envía Authorization: Bearer <token>'
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

function generarTokenInternoRotativo(method, pathConQuery) {
    const ts = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(8).toString('hex');
    const rutaNormalizada = pathConQuery.startsWith('/') ? pathConQuery : '/' + pathConQuery;
    const payload = `${ts}.${nonce}.${String(method || 'GET').toUpperCase()}.${rutaNormalizada}`;
    const firma = crypto
        .createHmac('sha256', INTERNAL_API_KEY)
        .update(payload)
        .digest('hex');
    return `${ts}.${nonce}.${firma}`;
}

async function llamarMicroservicio(baseUrl, method, pathConQuery, body = undefined) {
    const rutaNormalizada = pathConQuery.startsWith('/') ? pathConQuery : '/' + pathConQuery;
    const url = `${baseUrl}${rutaNormalizada}`;
    const opciones = {
        method,
        headers: {
            'Accept': 'application/json',
            'X-Internal-Key': INTERNAL_API_KEY,
            'X-Internal-Token': generarTokenInternoRotativo(method, rutaNormalizada)
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

function claveIntentoLogin(req, email) {
    const ip = req ? (req.ip || req.socket?.remoteAddress || '127.0.0.1') : '127.0.0.1';
    const correo = String(email || '').toLowerCase().trim() || 'anon';
    return `${ip}:${correo}`;
}

function verificarBloqueoBruteForce(req, email, res) {
    const clave = claveIntentoLogin(req, email);
    const registro = intentosLoginFallidos.get(clave);
    const ahora = Date.now();
    if (registro && registro.blockedUntil && ahora < registro.blockedUntil) {
        const segundosRestantes = Math.ceil((registro.blockedUntil - ahora) / 1000);
        registrarEventoSeguridad('BRUTE_FORCE_LOCKED', 'CRITICO', `Cuenta/IP bloqueada temporalmente (${email})`, req);
        res.status(429).json({
            status: 'error',
            code: 'BRUTE_FORCE_LOCKED',
            message: `Demasiados intentos fallidos de inicio de sesión. Bloqueado por seguridad durante ${segundosRestantes}s.`
        });
        return true;
    }
    return false;
}

function registrarFalloLogin(req, email) {
    const clave = claveIntentoLogin(req, email);
    const ahora = Date.now();
    let registro = intentosLoginFallidos.get(clave);
    if (!registro || (registro.blockedUntil && ahora >= registro.blockedUntil)) {
        registro = { count: 0, blockedUntil: 0 };
    }
    registro.count += 1;
    if (registro.count >= LOGIN_MAX_INTENTOS) {
        registro.blockedUntil = ahora + LOGIN_BLOQUEO_MS;
        registrarEventoSeguridad('BRUTE_FORCE_TRIGGERED', 'CRITICO', `Se activó bloqueo anti-fuerza bruta para ${email || 'usuario'}`, req);
    } else {
        registrarEventoSeguridad('LOGIN_FAILED', 'WARN', `Intento fallido #${registro.count} (${email || 'desconocido'})`, req);
    }
    intentosLoginFallidos.set(clave, registro);
}

function limpiarFallosLogin(req, email) {
    intentosLoginFallidos.delete(claveIntentoLogin(req, email));
}

function generarSesionAdmin(req = null) {
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
    const parTokens = emitirParTokens({
        sub: '0',
        rol: 'ADMIN',
        nombre: adminUser.nombre,
        email: adminUser.email
    }, null, req);
    registrarEventoSeguridad('ADMIN_LOGIN_SUCCESS', 'INFO', `Sesión Admin iniciada (${ADMIN_EMAIL})`, req);
    return {
        status: 'success',
        message: 'Acceso de Administrador autorizado',
        ...parTokens,
        usuario: adminUser
    };
}

async function manejarLogin(req, res) {
    const emailIntento = (req.body && req.body.email) || '';
    if (verificarBloqueoBruteForce(req, emailIntento, res)) {
        return;
    }
    try {
        const respuestaLogin = await llamarMicroservicio(PHP_API_URL, 'POST', '/login', req.body);
        if (respuestaLogin.status !== 200 || !respuestaLogin.data || !respuestaLogin.data.data) {
            if (respuestaLogin.status === 401) {
                registrarFalloLogin(req, emailIntento);
            }
            return res.status(respuestaLogin.status).json(respuestaLogin.data);
        }

        limpiarFallosLogin(req, emailIntento);
        const usuario = respuestaLogin.data.data;
        const parTokens = emitirParTokens({
            sub: String(usuario.id),
            rol: usuario.rol,
            nombre: usuario.nombre,
            email: usuario.email
        }, null, req);

        establecerCookiesAuthHttpOnly(res, parTokens, req);
        res.setHeader('X-CSRF-Token', parTokens.csrf_token);
        registrarEventoSeguridad('USER_LOGIN_SUCCESS', 'INFO', `Login exitoso con Cookie HttpOnly: ${usuario.email} (${usuario.rol})`, req);
        return res.status(200).json({
            status: 'success',
            message: 'Inicio de sesión exitoso (Cookie HttpOnly + Token Rotativo)',
            ...sanitizarMetadatosSesionParaBody(parTokens),
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
    if (verificarBloqueoBruteForce(req, email, res)) {
        return;
    }
    if (esCredencialAdmin(email, password)) {
        limpiarFallosLogin(req, email);
        const sesionAdmin = generarSesionAdmin(req);
        establecerCookiesAuthHttpOnly(res, sesionAdmin, req);
        res.setHeader('X-CSRF-Token', sesionAdmin.csrf_token);
        return res.status(200).json({
            status: 'success',
            message: sesionAdmin.message,
            ...sanitizarMetadatosSesionParaBody(sesionAdmin),
            usuario: sesionAdmin.usuario
        });
    }
    registrarFalloLogin(req, email);
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
                disponibilidad: (disponibilidad === false || disponibilidad === 'false' || disponibilidad === '0' || disponibilidad === 0) ? 0 : 1
            });
            if (resTrabajador.status !== 201) {
                await llamarMicroservicio(PHP_API_URL, 'DELETE', `/usuarios/${usuarioId}`);
                return res.status(resTrabajador.status).json(resTrabajador.data);
            }
            perfilCreado = { especialidad, disponibilidad: disponibilidad ?? true };
        }

        const parTokens = emitirParTokens({
            sub: String(usuarioId),
            rol: rolNormalizado,
            nombre,
            email
        }, null, req);

        establecerCookiesAuthHttpOnly(res, parTokens, req);
        res.setHeader('X-CSRF-Token', parTokens.csrf_token);
        registrarEventoSeguridad('USER_REGISTER_SUCCESS', 'INFO', `Alta de usuario con Cookie HttpOnly: ${email} (${rolNormalizado})`, req);
        return res.status(201).json({
            status: 'success',
            message: 'Usuario registrado correctamente',
            ...sanitizarMetadatosSesionParaBody(parTokens),
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

// =========================================================================
// ROTACIÓN CONSTANTE Y REVOCACIÓN DE TOKENS (/auth/refresh, /auth/logout, /auth/token-status, /auth/security-status)
// =========================================================================
app.post('/auth/refresh', (req, res) => {
    const cookies = req.cookies || parsearCookies(req);
    const refreshTokenRecibido = String(
        cookies[COOKIE_REFRESH_TOKEN] || (req.body && req.body.refresh_token) || ''
    ).trim();
    const ahora = Math.floor(Date.now() / 1000);

    let sesionObjetivo = null;

    if (refreshTokenRecibido) {
        const hashRecibido = hashTokenOpaco(refreshTokenRecibido);

        // Detección de robo / reuso de un refresh_token ya rotado
        if (refreshTokensUsados.has(hashRecibido)) {
            const infoRobo = refreshTokensUsados.get(hashRecibido);
            if (infoRobo && infoRobo.sid && sesionesActivas.has(infoRobo.sid)) {
                const sesionComprometida = sesionesActivas.get(infoRobo.sid);
                if (sesionComprometida.currentJti) tokensRevocados.set(sesionComprometida.currentJti, ahora + JWT_EXPIRES_SECONDS);
                if (sesionComprometida.previousJti) tokensRevocados.set(sesionComprometida.previousJti, ahora + JWT_EXPIRES_SECONDS);
                sesionesActivas.delete(infoRobo.sid);
            }
            limpiarCookiesAuthHttpOnly(res, req);
            registrarEventoSeguridad('TOKEN_REPLAY_DETECTED', 'CRITICO', 'Se detectó reutilización de un refresh_token antiguo. Familia de sesión revocada.', req);
            return res.status(401).json({
                status: 'error',
                code: 'REFRESH_REPLAY_DETECTED',
                message: 'No se pudo rotar el token: sesión expirada o refresh_token inválido. Inicia sesión nuevamente.'
            });
        }

        for (const sesion of sesionesActivas.values()) {
            if (sesion.refreshTokenHash === hashRecibido && ahora < sesion.expiresAt) {
                sesionObjetivo = sesion;
                break;
            }
        }
    }

    if (!sesionObjetivo && req.usuario && req.usuario.sid) {
        const sesionPorJwt = sesionesActivas.get(req.usuario.sid);
        if (sesionPorJwt && ahora < sesionPorJwt.expiresAt) {
            sesionObjetivo = sesionPorJwt;
        }
    }

    if (!sesionObjetivo && req.usuario) {
        const nuevoPar = emitirParTokens({
            sub: String(req.usuario.id),
            rol: req.usuario.rol,
            nombre: req.usuario.nombre,
            email: req.usuario.email
        }, null, req);
        establecerCookiesAuthHttpOnly(res, nuevoPar, req);
        res.setHeader('X-CSRF-Token', nuevoPar.csrf_token);
        return res.status(200).json({
            status: 'success',
            message: 'Token rotado y actualizado en Cookie HttpOnly',
            ...sanitizarMetadatosSesionParaBody(nuevoPar)
        });
    }

    if (!sesionObjetivo) {
        limpiarCookiesAuthHttpOnly(res, req);
        return res.status(401).json({
            status: 'error',
            code: 'REFRESH_INVALID',
            message: 'No se pudo rotar el token: sesión expirada o refresh_token inválido. Inicia sesión nuevamente.'
        });
    }

    const nuevoPar = emitirParTokens(sesionObjetivo.userPayload, sesionObjetivo, req);
    establecerCookiesAuthHttpOnly(res, nuevoPar, req);
    res.setHeader('X-CSRF-Token', nuevoPar.csrf_token);

    registrarEventoSeguridad('TOKEN_ROTATED', 'INFO', `Token rotado a ciclo #${nuevoPar.rot} en Cookie HttpOnly`, req);
    return res.status(200).json({
        status: 'success',
        message: 'Token rotado y actualizado en Cookie HttpOnly',
        ...sanitizarMetadatosSesionParaBody(nuevoPar)
    });
});

app.post('/auth/logout', (req, res) => {
    const ahora = Math.floor(Date.now() / 1000);
    const cookies = req.cookies || parsearCookies(req);
    const refreshCookie = cookies[COOKIE_REFRESH_TOKEN];

    if (req.usuario) {
        if (req.usuario.jti) {
            tokensRevocados.set(req.usuario.jti, ahora + JWT_EXPIRES_SECONDS);
        }
        if (req.usuario.sid && sesionesActivas.has(req.usuario.sid)) {
            const sesion = sesionesActivas.get(req.usuario.sid);
            if (sesion.currentJti) tokensRevocados.set(sesion.currentJti, ahora + JWT_EXPIRES_SECONDS);
            if (sesion.previousJti) tokensRevocados.set(sesion.previousJti, ahora + JWT_EXPIRES_SECONDS);
            sesionesActivas.delete(req.usuario.sid);
        }
        registrarEventoSeguridad('USER_LOGOUT', 'INFO', `Cierre de sesión, limpieza de Cookies HttpOnly y revocación (${req.usuario.email})`, req);
    } else if (refreshCookie) {
        const hashCookie = hashTokenOpaco(refreshCookie);
        for (const [sid, sesion] of sesionesActivas.entries()) {
            if (sesion.refreshTokenHash === hashCookie) {
                if (sesion.currentJti) tokensRevocados.set(sesion.currentJti, ahora + JWT_EXPIRES_SECONDS);
                if (sesion.previousJti) tokensRevocados.set(sesion.previousJti, ahora + JWT_EXPIRES_SECONDS);
                sesionesActivas.delete(sid);
                break;
            }
        }
    }

    limpiarCookiesAuthHttpOnly(res, req);
    return res.status(200).json({
        status: 'success',
        message: 'Sesión cerrada, Cookies HttpOnly eliminadas y tokens revocados inmediatamente'
    });
});

app.get('/auth/token-status', exigirAutenticacion, (req, res) => {
    const ahora = Math.floor(Date.now() / 1000);
    const sesion = req.usuario.sid ? sesionesActivas.get(req.usuario.sid) : null;
    return res.status(200).json({
        status: 'success',
        data: {
            jti: req.usuario.jti || null,
            sid: req.usuario.sid || null,
            rot: sesion ? sesion.rotCount : (req.usuario.rot || 1),
            csrf_token: sesion ? sesion.csrfToken : null,
            fgp: req.usuario.fgp || null,
            httponly_cookie: Boolean(req.usuario.httponly),
            auth_source: req.usuario.auth_source || 'httponly_cookie',
            expires_in: Math.max(0, (req.usuario.exp || ahora) - ahora),
            rotation_interval_seconds: TOKEN_ROTATION_INTERVAL_SECONDS,
            private_api_mode: true
        }
    });
});

app.get('/auth/security-status', exigirAutenticacion, (req, res) => {
    const ahora = Math.floor(Date.now() / 1000);
    const sesion = req.usuario.sid ? sesionesActivas.get(req.usuario.sid) : null;
    return res.status(200).json({
        status: 'success',
        data: {
            token_actual: {
                jti: req.usuario.jti || null,
                sid: req.usuario.sid || null,
                rot: sesion ? sesion.rotCount : (req.usuario.rot || 1),
                csrf_token: sesion ? sesion.csrfToken : null,
                fgp: req.usuario.fgp || obtenerHuellaCliente(req),
                httponly_cookie: true,
                cookie_flags: 'HttpOnly; SameSite=Strict; Path=/',
                auth_source: req.usuario.auth_source || 'httponly_cookie',
                expires_in: Math.max(0, (req.usuario.exp || ahora) - ahora),
                rotation_interval_seconds: TOKEN_ROTATION_INTERVAL_SECONDS
            },
            capas_activas: [
                { nombre: 'Flujo de Autenticación con Tokens + Cookies HttpOnly', estado: 'ACTIVO', detalle: 'freelancer_access_token y freelancer_refresh_token en Cookies HttpOnly + SameSite=Strict (invisibles a document.cookie / XSS)' },
                { nombre: 'APIs 100% Privadas (Zero Public Data)', estado: 'ACTIVO', detalle: 'Todos los endpoints exigen Cookie HttpOnly o Bearer Token válido' },
                { nombre: 'Rotación Constante de JWT + Refresh Token', estado: 'ACTIVO', detalle: `Ciclo automático cada ${TOKEN_ROTATION_INTERVAL_SECONDS}s con lista negra JTI` },
                { nombre: 'Detección de Robo / Replay de Refresh Token', estado: 'ACTIVO', detalle: 'Revocación inmediata de toda la familia de sesión si se reutiliza un token' },
                { nombre: 'Vinculación Criptográfica de Dispositivo (Fingerprint)', estado: 'ACTIVO', detalle: `Huella SHA-256 vinculada (${req.usuario.fgp || obtenerHuellaCliente(req)})` },
                { nombre: 'Protección Anti-CSRF Double-Submit (X-CSRF-Token)', estado: 'ACTIVO', detalle: 'Validación cruzada Cookie/Header en todas las operaciones POST, PUT, PATCH y DELETE' },
                { nombre: 'Firma Interna Rotativa Gateway ↔ Microservicios', estado: 'ACTIVO', detalle: 'X-Internal-Key + HMAC-SHA256 con timestamp y nonce anti-replay' },
                { nombre: 'WAF Ligero Anti-XSS / Anti-SQLi / Prototype Pollution', estado: 'ACTIVO', detalle: 'Inspección recursiva de body y query strings (límite 100 KB)' },
                { nombre: 'Rate Limiting Global & Anti-Brute-Force en Login', estado: 'ACTIVO', detalle: `${RATE_LIMIT_MAX_REQ} req/min/IP · Bloqueo tras ${LOGIN_MAX_INTENTOS} intentos fallidos` },
                { nombre: 'Cabeceras OWASP (CSP, NoSniff, Frame-Deny, No-Store)', estado: 'ACTIVO', detalle: 'Sin caché en disco de respuestas sensibles' }
            ],
            estadisticas: {
                sesiones_activas: sesionesActivas.size,
                tokens_revocados_en_lista_negra: tokensRevocados.size,
                refresh_tokens_consumidos: refreshTokensUsados.size
            },
            eventos_recientes: eventosSeguridad.slice(0, 15)
        }
    });
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

app.get('/trabajadores', exigirAutenticacion, async (req, res) => {
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

// =========================================================================
// PANEL DE RENDIMIENTO DE TRABAJADORES Y ENTREGABLES POR PROYECTO
// =========================================================================
const ENTREGABLES_FILE = path.resolve(__dirname, 'entregables_proyectos.json');

function leerEntregablesArchivo() {
    try {
        if (fs.existsSync(ENTREGABLES_FILE)) {
            const raw = fs.readFileSync(ENTREGABLES_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                return parsed;
            }
        }
    } catch (e) {
        console.error('Error leyendo entregables_proyectos.json:', e.message);
    }
    const iniciales = {
        "1": [
            {
                id: 101,
                proyecto_id: 1,
                trabajador_id: 8,
                autor_nombre: "Mateo Benítez",
                titulo: "Sistema de Diseño Tokens & Flujo Checkout Web3",
                tipo_entrega: "DISEÑO / PROTOTIPO",
                url_recurso: "https://figma.com/file/nexapay-web3-checkout",
                archivo_nombre: "nexapay-tokens-v2.fig",
                progreso: 75,
                descripcion: "Se completaron las pantallas del flujo de pago Web3, estados de carga y validación de billetera con soporte Dark Mode.",
                fecha: "2026-11-05 16:30:00"
            },
            {
                id: 102,
                proyecto_id: 1,
                trabajador_id: 8,
                autor_nombre: "Mateo Benítez",
                titulo: "Integración de Componentes React + Tailwind",
                tipo_entrega: "CÓDIGO / REPOSITORIO",
                url_recurso: "https://github.com/nexapay/web3-checkout-ui/pull/14",
                archivo_nombre: "checkout-components-bundle.zip",
                progreso: 90,
                descripcion: "Implementación responsive de los componentes de confirmación de transacción y recibo descargable.",
                fecha: "2026-11-08 11:15:00"
            }
        ],
        "3": [
            {
                id: 103,
                proyecto_id: 3,
                trabajador_id: 8,
                autor_nombre: "Mateo Benítez",
                titulo: "Dashboard Clínico B2B — Módulos de Analítica",
                tipo_entrega: "AVANCE DE SPRINT",
                url_recurso: "https://figma.com/file/bloom-health-analytics",
                archivo_nombre: "reporte-ux-bloomhealth.pdf",
                progreso: 60,
                descripcion: "Entrega de gráficas de cohortes clínicas, filtros por hospital y exportación de métricas.",
                fecha: "2026-11-07 14:20:00"
            }
        ]
    };
    try {
        fs.writeFileSync(ENTREGABLES_FILE, JSON.stringify(iniciales, null, 2), 'utf8');
    } catch (e) {}
    return iniciales;
}

function guardarEntregablesArchivo(data) {
    try {
        fs.writeFileSync(ENTREGABLES_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Error guardando entregables_proyectos.json:', e.message);
    }
}

app.get('/trabajadores-panel', exigirRoles('TRABAJADOR', 'CLIENTE', 'ADMIN'), async (req, res) => {
    try {
        const [resAsig, resReg] = await Promise.all([
            llamarMicroservicio(EXPRESS_API_URL, 'GET', '/asignaciones'),
            llamarMicroservicio(EXPRESS_API_URL, 'GET', '/registros-tiempo')
        ]);
        let asignaciones = (resAsig.status === 200 && resAsig.data && Array.isArray(resAsig.data.data))
            ? resAsig.data.data
            : [];
        let registrosTiempo = (resReg.status === 200 && resReg.data && Array.isArray(resReg.data.data))
            ? resReg.data.data
            : [];
        const todosEntregables = leerEntregablesArchivo();
        let entregables = {};

        if (req.usuario.rol === 'ADMIN') {
            entregables = todosEntregables;
        } else if (req.usuario.rol === 'TRABAJADOR') {
            asignaciones = asignaciones.filter(a => Number(a.trabajador_id) === req.usuario.id);
            const idsAsig = new Set(asignaciones.map(a => Number(a.id)));
            const idsProy = new Set(asignaciones.map(a => String(a.proyecto_id)));
            registrosTiempo = registrosTiempo.filter(r => idsAsig.has(Number(r.asignacion_id)));
            for (const proyId of idsProy) {
                if (todosEntregables[proyId]) {
                    entregables[proyId] = todosEntregables[proyId];
                }
            }
        } else if (req.usuario.rol === 'CLIENTE') {
            const proyectosCliente = await obtenerProyectosCliente(req.usuario.id, res);
            if (proyectosCliente === null) {
                return;
            }
            const idsProyCliente = new Set(proyectosCliente.map(p => Number(p.id)));
            asignaciones = asignaciones.filter(a => idsProyCliente.has(Number(a.proyecto_id)));
            const idsAsig = new Set(asignaciones.map(a => Number(a.id)));
            registrosTiempo = registrosTiempo.filter(r => idsAsig.has(Number(r.asignacion_id)));
            for (const proyId of idsProyCliente) {
                const clave = String(proyId);
                if (todosEntregables[clave]) {
                    entregables[clave] = todosEntregables[clave];
                }
            }
        }

        return res.json({
            status: 'success',
            data: {
                asignaciones,
                registrosTiempo,
                entregables
            }
        });
    } catch (error) {
        console.error('Error en GET /trabajadores-panel:', error.message);
        return res.status(502).json({
            status: 'error',
            message: 'No se pudo consolidar el panel de trabajadores.'
        });
    }
});

app.get('/proyectos/:id/entregables', exigirRoles('TRABAJADOR', 'CLIENTE', 'ADMIN'), (req, res) => {
    const proyId = String(Number(req.params.id));
    const todos = leerEntregablesArchivo();
    const lista = Array.isArray(todos[proyId]) ? todos[proyId] : [];
    return res.json({
        status: 'success',
        data: lista
    });
});

app.post('/proyectos/:id/entregables', exigirRoles('TRABAJADOR', 'CLIENTE', 'ADMIN'), async (req, res) => {
    const proyId = Number(req.params.id);
    if (!Number.isSafeInteger(proyId) || proyId <= 0) {
        return res.status(400).json({ status: 'error', message: 'ID de proyecto inválido.' });
    }
    const body = req.body || {};
    const titulo = String(body.titulo || '').trim();
    const descripcion = String(body.descripcion || '').trim();
    if (!titulo || !descripcion) {
        return res.status(400).json({
            status: 'error',
            message: 'El título y la descripción de la información/entregable son obligatorios.'
        });
    }

    const todos = leerEntregablesArchivo();
    const clave = String(proyId);
    if (!Array.isArray(todos[clave])) {
        todos[clave] = [];
    }

    const nuevo = {
        id: Date.now(),
        proyecto_id: proyId,
        trabajador_id: Number(body.trabajador_id || (req.usuario && req.usuario.id) || 0) || null,
        autor_nombre: String(body.autor_nombre || (req.usuario && req.usuario.nombre) || 'Especialista Asignado').trim(),
        titulo,
        tipo_entrega: String(body.tipo_entrega || 'AVANCE DE PROYECTO').trim(),
        url_recurso: body.url_recurso ? String(body.url_recurso).trim() : null,
        archivo_nombre: body.archivo_nombre ? String(body.archivo_nombre).trim() : null,
        progreso: Math.min(100, Math.max(0, Number(body.progreso ?? 50) || 0)),
        descripcion,
        fecha: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };

    todos[clave].unshift(nuevo);
    guardarEntregablesArchivo(todos);

    return res.status(201).json({
        status: 'success',
        message: 'Información subida al proyecto correctamente.',
        data: nuevo
    });
});

app.patch('/proyectos/:id', exigirRoles('TRABAJADOR', 'CLIENTE', 'ADMIN'), async (req, res) => {
    try {
        const proyId = Number(req.params.id);
        const resProy = await llamarMicroservicio(PYTHON_API_URL, 'GET', `/proyectos/${proyId}`);
        if (resProy.status !== 200 || !resProy.data) {
            return res.status(resProy.status).json(resProy.data);
        }
        if (req.usuario.rol === 'CLIENTE' && Number(resProy.data.cliente_id) !== req.usuario.id) {
            return res.status(403).json({ status: 'error', message: 'Solo el cliente propietario puede modificar este proyecto.' });
        }
        if (req.usuario.rol === 'TRABAJADOR') {
            const resAsig = await llamarMicroservicio(EXPRESS_API_URL, 'GET', `/asignaciones?trabajador_id=${req.usuario.id}`);
            const asignaciones = (resAsig.status === 200 && resAsig.data && Array.isArray(resAsig.data.data)) ? resAsig.data.data : [];
            const tieneAsignacion = asignaciones.some(a => Number(a.proyecto_id) === proyId);
            if (!tieneAsignacion) {
                return res.status(403).json({ status: 'error', message: 'Solo el trabajador asignado al proyecto puede actualizar su estado.' });
            }
        }
        return reenviarA(PYTHON_API_URL, req, res);
    } catch (error) {
        console.error('Error en PATCH /proyectos/:id:', error.message);
        return res.status(502).json({ status: 'error', message: 'No se pudo actualizar el proyecto.' });
    }
});

app.use('/proyectos/:id', (req, res, next) => {
    if (req.method === 'DELETE') {
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

app.use(['/proyectos', '/postulaciones'], exigirAutenticacion, (req, res) => {
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
