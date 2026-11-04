/**
 * Freelancer — Orquestador Principal de la Aplicación SPA
 */

const App = {
  vistaActual: 'marketplace',

  async iniciar() {
    console.log('Iniciando Freelancer SPA...');

    // Suscribir render de vistas a cambios de estado
    window.State.subscribe((event, data) => {
      this.actualizarUIUsuario();
      this.renderizarVistaActual();
    });

    // Cargar datos iniciales vía fetch()
    try {
      this.mostrarToast('Conectando con microservicios...', 'info');
      await window.State.recargarTodo();
      this.mostrarToast('Plataforma Freelancer sincronizada con MySQL', 'success');
    } catch (error) {
      this.mostrarToast(`Error al sincronizar datos: ${error.message}`, 'error');
    }

    // Inicializar Time Tracker del Running Dock
    if (window.Timer) {
      window.Timer.inicializar();
    }

    // Configurar router y vistas
    this.configurarRutas();
    this.renderizarVistaActual();
    this.poblarSelectorUsuarios();
  },

  configurarRutas() {
    // Si viene un hash en la URL (#talento, #workspace, etc.)
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (['marketplace', 'talento', 'workspace', 'contratos', 'finanzas'].includes(hash)) {
      this.vistaActual = hash;
    }

    window.addEventListener('hashchange', () => {
      const nuevoHash = window.location.hash.replace('#', '').toLowerCase();
      if (['marketplace', 'talento', 'workspace', 'contratos', 'finanzas'].includes(nuevoHash)) {
        this.cambiarVista(nuevoHash, false);
      }
    });
  },

  cambiarVista(nombreVista, actualizarHash = true) {
    this.vistaActual = nombreVista;
    if (actualizarHash) {
      window.location.hash = nombreVista;
    }

    // Actualizar tabs de navegación activa
    document.querySelectorAll('.nav-link').forEach(btn => {
      if (btn.dataset.vista === nombreVista) {
        btn.classList.add('nav-link-active');
        btn.classList.remove('nav-link-inactive');
      } else {
        btn.classList.remove('nav-link-active');
        btn.classList.add('nav-link-inactive');
      }
    });

    // Actualizar paneles visibles
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const panelActivo = document.getElementById(`view${nombreVista.charAt(0).toUpperCase() + nombreVista.slice(1)}`);
    if (panelActivo) {
      panelActivo.classList.add('active');
    }

    this.renderizarVistaActual();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  renderizarVistaActual() {
    switch (this.vistaActual) {
      case 'marketplace':
        if (window.MarketplaceView) window.MarketplaceView.render();
        break;
      case 'talento':
        if (window.TalentoView) window.TalentoView.render();
        break;
      case 'workspace':
        if (window.WorkspaceView) window.WorkspaceView.render();
        break;
      case 'contratos':
        if (window.ContratosView) window.ContratosView.render();
        break;
      case 'finanzas':
        if (window.FinanzasView) window.FinanzasView.render();
        break;
    }
  },

  /* ================= GESTOR DE USUARIO ACTIVO (SIMULADOR) ================= */
  poblarSelectorUsuarios() {
    const select = document.getElementById('userSwitcherSelect');
    if (!select) return;

    const usuarios = window.State.data.usuarios || [];
    select.innerHTML = '';

    usuarios.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.nombre} (${u.rol})`;
      if (window.State.data.usuarioActivo && window.State.data.usuarioActivo.id === u.id) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    select.addEventListener('change', (e) => {
      const userId = Number(e.target.value);
      const seleccionado = usuarios.find(u => u.id === userId);
      if (seleccionado) {
        window.State.setUsuarioActivo(seleccionado);
        this.mostrarToast(`Sesión cambiada a: ${seleccionado.nombre} (${seleccionado.rol})`, 'info');
      }
    });

    this.actualizarUIUsuario();
  },

  actualizarUIUsuario() {
    const usuario = window.State.data.usuarioActivo;
    const nameEl = document.getElementById('navUserName');
    const roleEl = document.getElementById('navUserRole');
    const avatarEl = document.getElementById('navUserAvatar');

    if (usuario) {
      if (nameEl) nameEl.textContent = usuario.nombre;
      if (roleEl) roleEl.textContent = usuario.rol;
      if (avatarEl) {
        const iniciales = usuario.nombre.split(' ').map(n => n[0]).slice(0, 2).join('');
        avatarEl.textContent = iniciales;
      }
    }
  },

  /* ================= MODAL PUBLICAR PROYECTO ================= */
  abrirModalPublicarProyecto() {
    const modal = document.getElementById('publicarProyectoModal');
    if (modal) modal.classList.add('open');
  },

  cerrarModalPublicarProyecto() {
    const modal = document.getElementById('publicarProyectoModal');
    if (modal) modal.classList.remove('open');
  },

  async guardarNuevoProyecto(event) {
    event.preventDefault();
    const titulo = document.getElementById('proyTituloInput').value;
    const descripcion = document.getElementById('proyDescInput').value;
    const tipo = document.getElementById('proyTipoSelect').value;
    const stack = document.getElementById('proyStackInput').value;

    const usuario = window.State.data.usuarioActivo;
    const clienteId = (usuario && usuario.rol === 'CLIENTE') ? usuario.id : 1;

    try {
      this.mostrarToast('Publicando proyecto en Python FastAPI (:5000)...', 'info');
      await window.API.crearProyecto({
        cliente_id: clienteId,
        nombre_proyecto: titulo,
        descripcion: descripcion,
        tipo: tipo,
        tipo_proyecto: tipo,
        especificaciones: {
          lenguaje_principal: stack || 'Full Stack Moderno',
          formato_entrega: 'Repositorio GitHub + Despliegue Cloud'
        }
      });

      this.cerrarModalPublicarProyecto();
      this.mostrarToast('¡Proyecto publicado exitosamente en MySQL!', 'success');
      await window.State.recargarTodo();
      this.cambiarVista('marketplace');
    } catch (error) {
      this.mostrarToast(`Error al publicar proyecto: ${error.message}`, 'error');
    }
  },

  /* ================= MODAL POSTULACIÓN ================= */
  cerrarModalPostulacion() {
    const modal = document.getElementById('postulacionModal');
    if (modal) modal.classList.remove('open');
  },

  async enviarPostulacion(event) {
    event.preventDefault();
    const proyectoId = document.getElementById('postulacionProyectoId').value;
    const tarifa = document.getElementById('postulacionTarifaInput').value;
    const mensaje = document.getElementById('postulacionMensajeInput').value;

    const usuario = window.State.data.usuarioActivo;
    const trabajadorId = (usuario && usuario.rol === 'TRABAJADOR') ? usuario.id : 8;

    try {
      this.mostrarToast('Enviando propuesta a Python FastAPI (:5000)...', 'info');
      await window.API.crearPostulacion(proyectoId, {
        trabajador_id: Number(trabajadorId),
        tarifa_propuesta: Number(tarifa),
        mensaje: mensaje
      });

      this.cerrarModalPostulacion();
      this.mostrarToast('¡Propuesta enviada exitosamente con custodia Escrow!', 'success');
      await window.State.recargarTodo();
      this.cambiarVista('contratos');
    } catch (error) {
      this.mostrarToast(`Error: ${error.message}`, 'error');
    }
  },

  /* ================= MODAL GENÉRICO ================= */
  abrirModalGenerico() {
    const modal = document.getElementById('genericModal');
    if (modal) modal.classList.add('open');
  },

  cerrarModalGenerico() {
    const modal = document.getElementById('genericModal');
    if (modal) modal.classList.remove('open');
  },

  /* ================= SISTEMA DE TOASTS ================= */
  mostrarToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    let bg = 'bg-slate-900 text-white';
    let icon = 'info';

    if (tipo === 'success') {
      bg = 'bg-emerald-900 text-emerald-100 border border-emerald-700/60';
      icon = 'check_circle';
    } else if (tipo === 'error') {
      bg = 'bg-rose-900 text-rose-100 border border-rose-700/60';
      icon = 'error';
    } else if (tipo === 'warning') {
      bg = 'bg-amber-900 text-amber-100 border border-amber-700/60';
      icon = 'warning';
    }

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-medium transition-all transform translate-y-2 opacity-0 ${bg}`;
    toast.innerHTML = `
      <span class="material-symbols-outlined text-[18px]">${icon}</span>
      <span class="flex-1">${mensaje}</span>
    `;

    container.appendChild(toast);

    // Entrada fluida
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    // Auto-cierre
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }
};

window.App = App;

// Auto-arranque al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  window.App.iniciar();
});
