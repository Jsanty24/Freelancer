/**
 * Freelancer — Motor de Seguimiento de Tiempo en Vivo (Time Tracker)
 */

class TimeTracker {
  constructor() {
    this.segundos = 0;
    this.activo = false;
    this.intervalId = null;
    this.tarifaHora = 70.0;
    this.asignacionSeleccionada = null;
    this.inicioTimestamp = null;
  }

  inicializar() {
    this.actualizarUI();
    this.poblarSelectorProyectos();

    window.State.subscribe((event) => {
      if (event === 'datos_cargados' || event === 'usuario_cambiado') {
        this.poblarSelectorProyectos();
      }
    });
  }

  poblarSelectorProyectos() {
    const select = document.getElementById('trackerProjectSelect');
    if (!select) return;

    const asignaciones = window.State.data.asignaciones || [];
    const proyectos = window.State.data.proyectos || [];

    select.innerHTML = '';

    if (asignaciones.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Sin proyectos asignados';
      select.appendChild(opt);
      return;
    }

    asignaciones.forEach((asig) => {
      const proy = proyectos.find(p => p.id === asig.proyecto_id);
      const nombreProy = proy ? proy.nombre_proyecto : `Proyecto #${asig.proyecto_id}`;
      const opt = document.createElement('option');
      opt.value = asig.id;
      opt.dataset.tarifa = asig.tarifa_por_hora || 70.0;
      opt.dataset.proyectoId = asig.proyecto_id;
      opt.textContent = `${nombreProy} ($${asig.tarifa_por_hora}/h)`;
      select.appendChild(opt);
    });

    if (!this.asignacionSeleccionada && asignaciones.length > 0) {
      this.seleccionarAsignacion(asignaciones[0].id);
    }
  }

  seleccionarAsignacion(asignacionId) {
    const asignaciones = window.State.data.asignaciones || [];
    const encontrada = asignaciones.find(a => String(a.id) === String(asignacionId));
    if (encontrada) {
      this.asignacionSeleccionada = encontrada;
      this.tarifaHora = Number(encontrada.tarifa_por_hora) || 70.0;
      this.actualizarUI();
    }
  }

  toggle() {
    if (this.activo) {
      this.pausar();
    } else {
      this.iniciar();
    }
  }

  iniciar() {
    if (this.activo) return;
    this.activo = true;
    if (!this.inicioTimestamp) {
      this.inicioTimestamp = new Date();
    }

    const playBtn = document.getElementById('trackerToggleBtn');
    const playIcon = document.getElementById('trackerToggleIcon');
    const statusBadge = document.getElementById('trackerStatusBadge');
    const dockContainer = document.getElementById('runningDock');

    if (playIcon) playIcon.textContent = 'pause';
    if (playBtn) playBtn.classList.replace('bg-primary-container', 'bg-amber-600');
    if (statusBadge) {
      statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Tracker Activo`;
      statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold';
    }
    if (dockContainer) dockContainer.classList.add('tracker-active-pulse');

    this.intervalId = setInterval(() => {
      this.segundos++;
      this.actualizarUI();
    }, 1000);

    window.App.mostrarToast('Temporizador iniciado para el proyecto activo', 'info');
  }

  pausar() {
    if (!this.activo) return;
    this.activo = false;
    clearInterval(this.intervalId);

    const playBtn = document.getElementById('trackerToggleBtn');
    const playIcon = document.getElementById('trackerToggleIcon');
    const statusBadge = document.getElementById('trackerStatusBadge');
    const dockContainer = document.getElementById('runningDock');

    if (playIcon) playIcon.textContent = 'play_arrow';
    if (playBtn) playBtn.classList.replace('bg-amber-600', 'bg-primary-container');
    if (statusBadge) {
      statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-400"></span> Pausado`;
      statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold';
    }
    if (dockContainer) dockContainer.classList.remove('tracker-active-pulse');
  }

  async guardarSesion() {
    if (this.segundos < 10) {
      window.App.mostrarToast('Se requiere al menos 10 segundos registrados para guardar en la base de datos', 'warning');
      return;
    }

    const select = document.getElementById('trackerProjectSelect');
    const asignacionId = select ? select.value : (this.asignacionSeleccionada ? this.asignacionSeleccionada.id : 1);

    if (!asignacionId) {
      window.App.mostrarToast('Selecciona un proyecto asignado válido', 'warning');
      return;
    }

    const horasDecimal = (this.segundos / 3600).toFixed(2);
    const fin = new Date();
    const inicio = this.inicioTimestamp || new Date(fin.getTime() - this.segundos * 1000);

    try {
      this.pausar();
      window.App.mostrarToast('Guardando registro de tiempo en la base de datos...', 'info');

      await window.API.crearRegistroTiempo({
        asignacion_id: Number(asignacionId),
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        horas: Number(horasDecimal) > 0 ? Number(horasDecimal) : 0.05,
        tarifa_aplicada: this.tarifaHora,
        origen: 'TEMPORIZADOR'
      });

      window.App.mostrarToast(`¡Sesión guardada con éxito! +${horasDecimal} hrs registradas`, 'success');
      
      // Reiniciar contador
      this.segundos = 0;
      this.inicioTimestamp = null;
      this.actualizarUI();

      // Recargar datos globales para actualizar el workspace y facturas
      await window.State.recargarTodo();
    } catch (error) {
      window.App.mostrarToast(`Error al guardar sesión: ${error.message}`, 'error');
    }
  }

  actualizarUI() {
    const horas = Math.floor(this.segundos / 3600);
    const minutos = Math.floor((this.segundos % 3600) / 60);
    const segs = this.segundos % 60;

    const formatoTiempo = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
    const clockEl = document.getElementById('trackerDigits');
    if (clockEl) {
      clockEl.textContent = formatoTiempo;
    }

    // Calcular acumulado monetario
    const acumulado = ((this.segundos / 3600) * this.tarifaHora).toFixed(2);
    const amountEl = document.getElementById('trackerAccumulated');
    if (amountEl) {
      amountEl.textContent = `$${acumulado} USD`;
    }
  }
}

window.Timer = new TimeTracker();
