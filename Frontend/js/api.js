/**
 * Freelancer — Módulo de Integración con Microservicios
 * Todos los llamados HTTP se realizan exclusivamente a través de la función nativa fetch()
 */

const API_BASE = window.location.origin;

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
        throw new Error(errorMsg);
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
    return this.request('/registros-tiempo', {
      method: 'POST',
      body: data
    });
  }

  /* ================= FACTURAS Y PAGOS (Node.js Express) ================= */
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

  async pagarFactura(facturaId) {
    return this.request(`/facturas/${facturaId}/pagar`, {
      method: 'PATCH'
    });
  }
}

// Instancia singleton para toda la SPA
window.API = new ApiClient();
