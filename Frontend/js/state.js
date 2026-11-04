/**
 * Freelancer — Gestor de Estado Reactivo
 */

class AppState {
  constructor() {
    this.data = {
      usuarios: [],
      trabajadores: [],
      clientes: [],
      proyectos: [],
      postulaciones: [],
      asignaciones: [],
      registrosTiempo: [],
      facturas: [],
      usuarioActivo: null,
      filtroMarketplace: 'TODOS',
      filtroTalento: 'TODOS',
      busquedaTexto: ''
    };

    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify(event, payload) {
    for (const listener of this.listeners) {
      try {
        listener(event, payload, this.data);
      } catch (err) {
        console.error('Error en listener de estado:', err);
      }
    }
  }

  setUsuarioActivo(usuario) {
    this.data.usuarioActivo = usuario;
    if (usuario) {
      localStorage.setItem('freelancer_active_user', JSON.stringify(usuario));
    }
    this.notify('usuario_cambiado', usuario);
  }

  async recargarTodo() {
    try {
      const [
        usuarios,
        trabajadores,
        clientes,
        proyectos,
        postulaciones,
        asignaciones,
        registrosTiempo,
        facturas
      ] = await Promise.all([
        window.API.getUsuarios().catch(() => []),
        window.API.getTrabajadores().catch(() => []),
        window.API.getClientes().catch(() => []),
        window.API.getProyectos(100, 0).catch(() => []),
        window.API.getPostulaciones().catch(() => []),
        window.API.getAsignaciones().catch(() => []),
        window.API.getRegistrosTiempo().catch(() => []),
        window.API.getFacturas().catch(() => [])
      ]);

      this.data.usuarios = usuarios;
      this.data.trabajadores = trabajadores;
      this.data.clientes = clientes;
      this.data.proyectos = proyectos;
      this.data.postulaciones = postulaciones;
      this.data.asignaciones = asignaciones;
      this.data.registrosTiempo = registrosTiempo;
      this.data.facturas = facturas;

      // Si no hay usuario activo, cargar de localStorage o por defecto al trabajador Mateo Benítez (id 8)
      if (!this.data.usuarioActivo) {
        const guardado = localStorage.getItem('freelancer_active_user');
        if (guardado) {
          try {
            this.data.usuarioActivo = JSON.parse(guardado);
          } catch {
            this.data.usuarioActivo = null;
          }
        }
        if (!this.data.usuarioActivo) {
          const defaultUser = usuarios.find(u => u.id === 8) || usuarios[0] || null;
          this.data.usuarioActivo = defaultUser;
        }
      }

      this.notify('datos_cargados', this.data);
      return this.data;
    } catch (error) {
      console.error('Error recargando estado global:', error);
      throw error;
    }
  }
}

window.State = new AppState();
