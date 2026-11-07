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
    this.token = localStorage.getItem('freelancer_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('freelancer_token', token);
    } else {
      localStorage.removeItem('freelancer_token');
    }
  }

  /**
   * Helper genérico para peticiones fetch() nativas
   */
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const headers = {
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
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

      if (!response.ok) {
        const errorMsg = (data && data.message) || (data && data.detail) || `Error HTTP ${response.status}`;
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

  /* ================= USUARIOS Y PERFILES (PHP) ================= */
  async getUsuarios() {
    const res = await this.request('/usuarios');
    return res && res.data ? res.data : [];
  }

  async getTrabajadores() {
    const res = await this.request('/trabajadores');
    return res && res.data ? res.data : [];
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
    if (res && res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  async adminLogin(email, password) {
    const res = await this.request('/auth/admin-login', {
      method: 'POST',
      body: { email, password }
    });
    if (res && res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  async registro(usuarioData) {
    return this.request('/auth/registro', {
      method: 'POST',
      body: usuarioData
    });
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

  /* ================= ASIGNACIONES (Node.js Express) ================= */
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

  /* ================= REGISTROS DE TIEMPO (Node.js Express) ================= */
  async getRegistrosTiempo() {
    const res = await this.request('/registros-tiempo');
    return res && res.data ? res.data : [];
  }

  async crearRegistroTiempo(data) {
    if (!Number.isSafeInteger(Number(data.asignacion_id)) || Number(data.asignacion_id) <= 0) {
      throw new Error('Selecciona una asignación válida para registrar las horas.');
    }

    return this.request(`/asignaciones/${Number(data.asignacion_id)}/horas-manuales`, {
      method: 'POST',
      body: {
        horas: data.horas,
        inicio: data.inicio,
        fin: data.fin
      }
    });
  }

  /* ================= FACTURAS (Node.js Express) ================= */
  async getFacturas() {
    const res = await this.request('/facturas');
    return res && res.data ? res.data : [];
  }

  async crearFactura(data) {
    return this.request('/facturas', {
      method: 'POST',
      body: data
    });
  }

}

// Instancia singleton para toda la SPA
window.API = new ApiClient();
