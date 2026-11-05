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
      erroresServicios: {},
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
    this.notify('usuario_cambiado', usuario);
  }

  limpiarDatosPrivados() {
    this.data.usuarios = [];
    this.data.clientes = [];
    this.data.postulaciones = [];
    this.data.asignaciones = [];
    this.data.registrosTiempo = [];
    this.data.facturas = [];
    this.notify('sesion_cerrada', null);
  }

  async recargarTodo() {
    const esAdmin = window.App && window.App.esAdministradorAutenticado();
    const autenticado = Boolean(this.data.usuarioActivo);
    const cargar = async (servicio, solicitud) => {
      try {
        const resultado = await solicitud();
        delete this.data.erroresServicios[servicio];
        return resultado;
      } catch (error) {
        console.error(`Error cargando ${servicio}:`, error);
        this.data.erroresServicios[servicio] = error.message || 'Servicio no disponible';
        return [];
      }
    };

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
      esAdmin ? cargar('Usuarios', () => window.API.getUsuarios()) : Promise.resolve([]),
      cargar('Directorio de talento', () => window.API.getTrabajadores()),
      esAdmin ? cargar('Clientes', () => window.API.getClientes()) : Promise.resolve([]),
      cargar('Proyectos', () => window.API.getProyectos(100, 0)),
      autenticado ? cargar('Postulaciones', () => window.API.getPostulaciones()) : Promise.resolve([]),
      autenticado ? cargar('Asignaciones', () => window.API.getAsignaciones()) : Promise.resolve([]),
      autenticado ? cargar('Registros de tiempo', () => window.API.getRegistrosTiempo()) : Promise.resolve([]),
      autenticado ? cargar('Facturas', () => window.API.getFacturas()) : Promise.resolve([])
    ]);

    this.data.usuarios = usuarios;
    this.data.trabajadores = trabajadores;
    this.data.clientes = clientes;
    this.data.proyectos = proyectos;
    this.data.postulaciones = postulaciones;
    this.data.asignaciones = asignaciones;
    this.data.registrosTiempo = registrosTiempo;
    this.data.facturas = facturas;

    this.notify('datos_cargados', this.data);
    return this.data;
  }
}

window.State = new AppState();
