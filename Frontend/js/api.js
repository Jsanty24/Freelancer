/**
 * Freelancer — Módulo de Integración con Microservicios
 * Todos los llamados HTTP se realizan exclusivamente a través de la función nativa fetch()
 */

const esCapacitorNativo = Boolean(
  window.Capacitor &&
  typeof window.Capacitor.isNativePlatform === 'function' &&
  window.Capacitor.isNativePlatform()
);
const API_BASE = (
  window.FREELANCER_API_BASE ||
  (esCapacitorNativo ? 'http://10.0.2.2:4000' : window.location.origin)
).replace(/\/+$/, '');

class ApiClient {
  constructor() {
    // Limpiar cualquier token expuesto en localStorage o sessionStorage:
    // El token real viaja en Cookies HttpOnly (SameSite=Strict) inaccesibles a JavaScript.
    try {
      localStorage.removeItem('freelancer_token');
      localStorage.removeItem('freelancer_refresh_token');
      localStorage.removeItem('freelancer_token_meta');
      if (!esCapacitorNativo) {
        sessionStorage.removeItem('freelancer_token');
        sessionStorage.removeItem('freelancer_refresh_token');
      }
    } catch {}

    this.token = esCapacitorNativo ? (sessionStorage.getItem('freelancer_token') || null) : null;
    this.refreshToken = esCapacitorNativo ? (sessionStorage.getItem('freelancer_refresh_token') || null) : null;
    this.tokenMeta = this.cargarMetaToken();
    this.sesionActiva = Boolean(this.token || (this.tokenMeta && this.tokenMeta.jti));
    this.intervaloRotacion = null;
    this.promesaRotacionEnCurso = null;
    this.rotacionIntervalSeconds = 30;
    this.listenersRotacion = [];

    if (this.sesionActiva) {
      this.iniciarRotacionAutomatica();
    }
  }

  leerCookieNoHttpOnly(nombre) {
    try {
      const partes = String(document.cookie || '').split(';');
      for (const p of partes) {
        const idx = p.indexOf('=');
        if (idx < 0) continue;
        const k = p.slice(0, idx).trim();
        const v = p.slice(idx + 1).trim();
        if (k === nombre) return decodeURIComponent(v);
      }
    } catch {}
    return null;
  }

  cargarMetaToken() {
    try {
      const guardado = sessionStorage.getItem('freelancer_token_meta');
      if (guardado) return JSON.parse(guardado);
    } catch {}
    return {
      jti: null,
      rot: 1,
      csrf_token: this.leerCookieNoHttpOnly('freelancer_csrf_token') || null,
      fgp: null,
      httponly_cookie: true,
      expires_in: 180,
      rotation_interval_seconds: 30,
      rotated_at: null,
      last_rotated_ms: Date.now()
    };
  }

  onTokenRotated(cb) {
    this.listenersRotacion.push(cb);
  }

  notificarRotacion() {
    for (const cb of this.listenersRotacion) {
      try {
        cb(this.tokenMeta, Boolean(this.sesionActiva));
      } catch (e) {
        console.warn('Error en listener de rotación:', e);
      }
    }
  }

  setToken(token, refreshToken = undefined, meta = undefined) {
    const activar = Boolean(token || (meta && (meta.httponly_cookie || meta.rot)));
    this.sesionActiva = activar;
    // Los tokens reales viajan 100% en Cookies HttpOnly (nunca en body, ni en cabeceras, ni en JS).
    this.token = activar ? 'httponly_cookie_session' : null;
    this.refreshToken = null;

    if (activar) {
      try {
        sessionStorage.removeItem('freelancer_token');
        sessionStorage.removeItem('freelancer_refresh_token');
      } catch {}

      const csrfDesdeCookie = this.leerCookieNoHttpOnly('freelancer_csrf_token');
      if (meta && typeof meta === 'object') {
        this.tokenMeta = {
          ...this.tokenMeta,
          ...meta,
          csrf_token: meta.csrf_token || csrfDesdeCookie || this.tokenMeta.csrf_token,
          httponly_cookie: true,
          last_rotated_ms: Date.now()
        };
        if (meta.rotation_interval_seconds) {
          this.rotacionIntervalSeconds = Number(meta.rotation_interval_seconds) || 30;
        }
        try {
          sessionStorage.setItem('freelancer_token_meta', JSON.stringify(this.tokenMeta));
        } catch {}
      }
      this.iniciarRotacionAutomatica();
    } else {
      this.token = null;
      this.refreshToken = null;
      this.sesionActiva = false;
      this.tokenMeta = {
        jti: null,
        rot: 0,
        csrf_token: null,
        fgp: null,
        httponly_cookie: true,
        expires_in: 0,
        rotation_interval_seconds: 30,
        rotated_at: null,
        last_rotated_ms: 0
      };
      try {
        sessionStorage.removeItem('freelancer_token');
        sessionStorage.removeItem('freelancer_refresh_token');
        sessionStorage.removeItem('freelancer_token_meta');
        localStorage.removeItem('freelancer_token');
        localStorage.removeItem('freelancer_refresh_token');
        localStorage.removeItem('freelancer_token_meta');
      } catch {}
      this.detenerRotacionAutomatica();
    }
    this.notificarRotacion();
  }

  iniciarRotacionAutomatica() {
    this.detenerRotacionAutomatica();
    if (!this.sesionActiva) return;
    const msIntervalo = Math.max(10000, (this.rotacionIntervalSeconds || 30) * 1000);
    this.intervaloRotacion = setInterval(async () => {
      if (!this.sesionActiva) return;
      try {
        await this.rotarToken();
      } catch (err) {
        console.warn('[Auto-Rotación de Token HttpOnly]:', err.message);
      }
    }, msIntervalo);
  }

  detenerRotacionAutomatica() {
    if (this.intervaloRotacion) {
      clearInterval(this.intervaloRotacion);
      this.intervaloRotacion = null;
    }
  }

  async rotarToken() {
    if (this.promesaRotacionEnCurso) {
      return this.promesaRotacionEnCurso;
    }

    this.promesaRotacionEnCurso = (async () => {
      try {
        const url = `${API_BASE}/auth/refresh`;
        const headers = {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        };
        const csrfToken = (this.tokenMeta && this.tokenMeta.csrf_token) || this.leerCookieNoHttpOnly('freelancer_csrf_token');
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken;
        }
        const response = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({})
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.status !== 'success') {
          throw new Error((data && data.message) || 'No se pudo rotar la Cookie HttpOnly');
        }
        this.setToken('httponly_cookie_session', null, {
          rot: Number(data.rot || (this.tokenMeta.rot + 1)),
          csrf_token: data.csrf_token || response.headers.get('X-CSRF-Token') || this.leerCookieNoHttpOnly('freelancer_csrf_token') || this.tokenMeta.csrf_token,
          httponly_cookie: true,
          expires_in: Number(data.expires_in) || 180,
          rotation_interval_seconds: Number(data.rotation_interval_seconds) || 30,
          rotated_at: data.rotated_at || new Date().toISOString()
        });
        return data;
      } finally {
        this.promesaRotacionEnCurso = null;
      }
    })();

    return this.promesaRotacionEnCurso;
  }

  async cerrarSesionRemota() {
    try {
      const headers = { 'Accept': 'application/json' };
      const csrfToken = (this.tokenMeta && this.tokenMeta.csrf_token) || this.leerCookieNoHttpOnly('freelancer_csrf_token');
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers
      });
    } catch {}
    this.setToken(null);
  }

  /**
   * Helper genérico para peticiones fetch() nativas con Cookies HttpOnly (sin exponer tokens en cabeceras ni body)
   */
  async request(endpoint, options = {}, esReintento = false) {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const headers = {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Client-Timestamp': String(Date.now()),
      ...(options.headers || {})
    };

    const csrfActivo = (this.tokenMeta && this.tokenMeta.csrf_token) || this.leerCookieNoHttpOnly('freelancer_csrf_token');
    if (csrfActivo) {
      headers['X-CSRF-Token'] = csrfActivo;
    }

    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData) && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    } else if (typeof body === 'string') {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        body,
        headers
      });

      const csrfHeader = response.headers.get('X-CSRF-Token');
      if (csrfHeader && this.tokenMeta) {
        this.tokenMeta.csrf_token = csrfHeader;
      }

      const contentType = response.headers.get('content-type') || '';

      let data = null;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      // Si el access_token HttpOnly expiró justo antes de la petición, rotar automáticamente con la cookie HttpOnly de refresh y reintentar 1 vez
      if (
        response.status === 401 &&
        !esReintento &&
        this.sesionActiva &&
        !endpoint.startsWith('/auth/login') &&
        !endpoint.startsWith('/auth/admin-login') &&
        !endpoint.startsWith('/auth/refresh')
      ) {
        try {
          await this.rotarToken();
          return await this.request(endpoint, options, true);
        } catch {
          // Si también falla el refresh, continuar al manejo de error normal
        }
      }

      if (!response.ok) {
        const errorMsg = (data && data.message) || (data && data.error) || (data && data.detail) || `Error HTTP ${response.status}`;
        const error = new Error(errorMsg);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (error) {
      console.error(`[API fetch error] ${options.method || 'GET'} ${url}:`, error.message);
      throw error;
    }
  }

  /* ================= SALUD ================= */
  async getHealth() {
    return this.request('/health');
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async getSecurityStatus() {
    return this.request('/auth/security-status');
  }

  /* ================= USUARIOS Y PERFILES (PHP) ================= */
  async getUsuarios() {
    const res = await this.request('/usuarios');
    return res && res.data ? res.data : [];
  }

  async getTrabajadores() {
    const res = await this.request('/trabajadores');
    return res && res.data ? res.data : [];
  }

  async getPanelTrabajadores() {
    const res = await this.request('/trabajadores-panel');
    return res && res.data ? res.data : { asignaciones: [], registrosTiempo: [], entregables: {} };
  }

  async getEntregablesProyecto(proyectoId) {
    const res = await this.request(`/proyectos/${Number(proyectoId)}/entregables`);
    return res && res.data ? res.data : [];
  }

  async subirEntregableProyecto(proyectoId, data) {
    return this.request(`/proyectos/${Number(proyectoId)}/entregables`, {
      method: 'POST',
      body: data
    });
  }

  async getClientes() {
    const res = await this.request('/clientes');
    return res && res.data ? res.data : [];
  }

  async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    if (res && res.status === 'success') {
      this.setToken('httponly_cookie_session', null, {
        rot: res.rot || 1,
        csrf_token: res.csrf_token || null,
        httponly_cookie: true,
        expires_in: res.expires_in || 180,
        rotation_interval_seconds: res.rotation_interval_seconds || 30,
        rotated_at: res.rotated_at || new Date().toISOString()
      });
    }
    return res;
  }

  async adminLogin(email, password) {
    const res = await this.request('/auth/admin-login', {
      method: 'POST',
      body: { email, password }
    });
    if (res && res.status === 'success') {
      this.setToken('httponly_cookie_session', null, {
        rot: res.rot || 1,
        csrf_token: res.csrf_token || null,
        httponly_cookie: true,
        expires_in: res.expires_in || 180,
        rotation_interval_seconds: res.rotation_interval_seconds || 30,
        rotated_at: res.rotated_at || new Date().toISOString()
      });
    }
    return res;
  }

  async registro(usuarioData) {
    const res = await this.request('/auth/registro', {
      method: 'POST',
      body: usuarioData
    });
    if (res && res.status === 'success') {
      this.setToken('httponly_cookie_session', null, {
        rot: res.rot || 1,
        csrf_token: res.csrf_token || null,
        httponly_cookie: true,
        expires_in: res.expires_in || 180,
        rotation_interval_seconds: res.rotation_interval_seconds || 30,
        rotated_at: res.rotated_at || new Date().toISOString()
      });
    }
    return res;
  }

  /* ================= PROYECTOS (Python FastAPI) ================= */
  async getProyectos(limit = 50, offset = 0) {
    const res = await this.request(`/proyectos?limit=${limit}&offset=${offset}`);
    return res && res.items ? res.items : (Array.isArray(res) ? res : []);
  }

  async getProyecto(id) {
    return this.request(`/proyectos/${id}`);
  }

  async crearProyecto(proyectoData) {
    return this.request('/proyectos', {
      method: 'POST',
      body: proyectoData
    });
  }

  async actualizarEstadoProyecto(id, nuevoEstado) {
    return this.request(`/proyectos/${id}`, {
      method: 'PATCH',
      body: { estado: nuevoEstado }
    });
  }

  async eliminarProyecto(id) {
    return this.request(`/proyectos/${id}`, {
      method: 'DELETE'
    });
  }

  /* ================= POSTULACIONES (Python FastAPI) ================= */
  async getPostulaciones(proyectoId = null) {
    if (proyectoId) {
      return this.request(`/proyectos/${proyectoId}/postulaciones`);
    }
    return this.request('/postulaciones');
  }

  async crearPostulacion(proyectoId, data) {
    return this.request(`/proyectos/${proyectoId}/postulaciones`, {
      method: 'POST',
      body: data
    });
  }

  async responderPostulacion(postulacionId, estado, rolEnProyecto = 'Freelancer') {
    return this.request(`/postulaciones/${postulacionId}`, {
      method: 'PATCH',
      body: {
        estado, // 'ACEPTADA' o 'RECHAZADA'
        rol_en_proyecto: rolEnProyecto,
        crear_asignacion: true
      }
    });
  }

  /* ================= ASIGNACIONES Y TEMPORIZADOR (Node.js Express) ================= */
  async getAsignaciones() {
    const res = await this.request('/asignaciones');
    return res && res.data ? res.data : [];
  }

  async crearAsignacion(data) {
    return this.request('/asignaciones', {
      method: 'POST',
      body: data
    });
  }

  async obtenerValorAsignacion(asignacionId) {
    return this.request(`/asignaciones/${Number(asignacionId)}/valor`);
  }

  async iniciarTemporizador(asignacionId) {
    return this.request(`/asignaciones/${Number(asignacionId)}/temporizador`, {
      method: 'POST'
    });
  }

  async detenerTemporizador(asignacionId) {
    return this.request(`/asignaciones/${Number(asignacionId)}/temporizador`, {
      method: 'DELETE'
    });
  }

  /* ================= REGISTROS DE TIEMPO (Node.js Express) ================= */
  async getRegistrosTiempo() {
    const res = await this.request('/registros-tiempo');
    return res && res.data ? res.data : [];
  }

  async crearRegistroTiempo(data) {
    if (!Number.isSafeInteger(Number(data.asignacion_id)) || Number(data.asignacion_id) <= 0) {
      throw new Error('Selecciona una asignación válida para registrar las horas.');
    }

    return this.request(`/asignaciones/${Number(data.asignacion_id)}/registros-tiempo`, {
      method: 'POST',
      body: {
        horas: data.horas,
        inicio: data.inicio,
        fin: data.fin
      }
    });
  }

  async aprobarRegistroTiempo(id, tarifaAplicada = undefined) {
    const body = { estado: 'APROBADO' };
    if (tarifaAplicada !== undefined && tarifaAplicada !== null && !isNaN(Number(tarifaAplicada)) && Number(tarifaAplicada) > 0) {
      body.tarifa_aplicada = Number(tarifaAplicada);
    }
    return this.request(`/registros-tiempo/${Number(id)}`, {
      method: 'PATCH',
      body
    });
  }

  async eliminarRegistroTiempo(id) {
    return this.request(`/registros-tiempo/${Number(id)}`, {
      method: 'DELETE'
    });
  }

  /* ================= FACTURAS (Node.js Express) ================= */
  async getFacturas() {
    const res = await this.request('/facturas');
    return res && res.data ? res.data : [];
  }

  async getFactura(id) {
    const res = await this.request(`/facturas/${Number(id)}`);
    return res && res.data ? res.data : res;
  }

  async crearFactura(data) {
    return this.request('/facturas', {
      method: 'POST',
      body: data
    });
  }

  async actualizarEstadoFactura(id, estadoFactura) {
    return this.request(`/facturas/${Number(id)}`, {
      method: 'PATCH',
      body: { estado_factura: estadoFactura }
    });
  }

  async aprobarFactura(id) {
    return this.actualizarEstadoFactura(id, 'APROBADA');
  }

}

// Instancia singleton para toda la SPA
window.API = new ApiClient();
