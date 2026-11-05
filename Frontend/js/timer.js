/**
 * Freelancer — Motor de Seguimiento de Tiempo en Vivo (Time Tracker)
 * Con Persistencia en localStorage (recargas F5, cambios de pestaña y sincronización)
 */

class TimeTracker {
  constructor() {
    this.segundos = 0;
    this.activo = false;
    this.intervalId = null;
    this.tarifaHora = 70.0;
    this.asignacionSeleccionada = null;
    this.inicioTimestamp = null;
    this.baseSegundos = 0;
  }

  inicializar() {
    this.poblarSelectorProyectos();
    this.restaurarDeStorage();
    this.actualizarUI();

    window.State.subscribe((event) => {
      if (event === 'datos_cargados' || event === 'usuario_cambiado') {
        this.poblarSelectorProyectos();
      }
    });

    // Sincronización precisa si la pestaña pasa a segundo plano o se desenfoca
    document.addEventListener('visibilitychange', () => {
      if (this.activo && this.inicioTimestamp) {
        const transcurrido = Math.floor((Date.now() - this.inicioTimestamp.getTime()) / 1000);
        this.segundos = this.baseSegundos + Math.max(0, transcurrido);
        this.actualizarUI();
      }
    });
  }

  /* ================= PERSISTENCIA EN LOCALSTORAGE ================= */
  guardarEnStorage() {
    const estado = {
      isRunning: this.activo,
      startTime: this.inicioTimestamp ? this.inicioTimestamp.getTime() : null,
      baseSeconds: this.baseSegundos,
      segundos: this.segundos,
      asignacionId: this.asignacionSeleccionada ? this.asignacionSeleccionada.id : null,
      tarifaHora: this.tarifaHora
    };
    try {
      localStorage.setItem('freelancer_timer_state', JSON.stringify(estado));
    } catch (err) {
      console.warn('No se pudo guardar el estado del timer en localStorage:', err);
    }
  }

  restaurarDeStorage() {
    try {
      const raw = localStorage.getItem('freelancer_timer_state');
      if (!raw) return;

      const estado = JSON.parse(raw);
      if (!estado) return;

      if (estado.tarifaHora) {
        this.tarifaHora = Number(estado.tarifaHora) || 70.0;
      }

      if (estado.asignacionId) {
        this.seleccionarAsignacion(estado.asignacionId);
      }

      this.baseSegundos = Number(estado.baseSeconds) || 0;

      if (estado.isRunning && estado.startTime) {
        const tiempoInicio = new Date(estado.startTime);
        const transcurrido = Math.floor((Date.now() - tiempoInicio.getTime()) / 1000);
        this.inicioTimestamp = tiempoInicio;
        this.segundos = this.baseSegundos + Math.max(0, transcurrido);
        // Reanudar automáticamente
        this.iniciar(true);
      } else if (estado.segundos > 0) {
        this.segundos = Number(estado.segundos);
        this.baseSegundos = this.segundos;
        this.actualizarUI();
      }
    } catch (err) {
      console.error('Error restaurando temporizador:', err);
    }
  }

  limpiarStorage() {
    localStorage.removeItem('freelancer_timer_state');
  }

  /* ================= GESTIÓN DE ASIGNACIONES ================= */
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
      if (this.asignacionSeleccionada && String(this.asignacionSeleccionada.id) === String(asig.id)) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    select.onchange = (e) => {
      this.seleccionarAsignacion(e.target.value);
    };

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
      
      const select = document.getElementById('trackerProjectSelect');
      if (select && select.value !== String(asignacionId)) {
        select.value = asignacionId;
      }
      this.actualizarUI();
      this.guardarEnStorage();
    }
  }

  toggle() {
    if (this.activo) {
      this.pausar();
    } else {
      this.iniciar();
    }
  }

  iniciar(esRestauracion = false) {
    if (this.activo && !esRestauracion) return;
    this.activo = true;
    
    if (!this.inicioTimestamp) {
      this.inicioTimestamp = new Date();
    }

    const playBtn = document.getElementById('trackerToggleBtn');
    const playIcon = document.getElementById('trackerToggleIcon');
    const statusBadge = document.getElementById('trackerStatusBadge');
    const dockContainer = document.getElementById('runningDock');

    if (playIcon) playIcon.textContent = 'pause';
    if (playBtn) {
      playBtn.classList.remove('btn-primary');
      playBtn.classList.add('bg-amber-600', 'text-white', 'btn-primary');
    }
    if (statusBadge) {
      statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Tracker Activo`;
      statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold';
    }
    if (dockContainer) dockContainer.classList.add('tracker-active-pulse');

    clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      const transcurrido = Math.floor((Date.now() - this.inicioTimestamp.getTime()) / 1000);
      this.segundos = this.baseSegundos + Math.max(0, transcurrido);
      this.actualizarUI();
    }, 1000);

    this.guardarEnStorage();

    if (!esRestauracion && window.App) {
      window.App.mostrarToast('Temporizador en marcha (persistido en navegador)', 'info');
    }
  }

  pausar() {
    if (!this.activo) return;
    this.activo = false;
    clearInterval(this.intervalId);

    // Fijar la base acumulada
    this.baseSegundos = this.segundos;
    this.inicioTimestamp = null;

    const playBtn = document.getElementById('trackerToggleBtn');
    const playIcon = document.getElementById('trackerToggleIcon');
    const statusBadge = document.getElementById('trackerStatusBadge');
    const dockContainer = document.getElementById('runningDock');

    if (playIcon) playIcon.textContent = 'play_arrow';
    if (playBtn) {
      playBtn.classList.remove('bg-amber-600');
    }
    if (statusBadge) {
      statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-400"></span> Pausado`;
      statusBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold';
    }
    if (dockContainer) dockContainer.classList.remove('tracker-active-pulse');

    this.guardarEnStorage();
    if (window.App) {
      window.App.mostrarToast('Temporizador pausado. Tiempo guardado en caché local.', 'info');
    }
  }

  async guardarSesion() {
    if (this.segundos < 10) {
      window.App.mostrarToast('Se requiere al menos 10 segundos registrados para guardar en la base de datos', 'warning');
      return;
    }

    const select = document.getElementById('trackerProjectSelect');
    const asignacionId = select && select.value ? select.value : (this.asignacionSeleccionada ? this.asignacionSeleccionada.id : null);

    if (!asignacionId) {
      window.App.mostrarToast('Selecciona un proyecto asignado válido', 'warning');
      return;
    }

    const horasDecimal = (this.segundos / 3600).toFixed(2);
    const fin = new Date();
    const inicio = new Date(fin.getTime() - this.segundos * 1000);

    try {
      this.pausar();
      window.App.mostrarToast('Guardando registro de tiempo en MySQL...', 'info');

      await window.API.crearRegistroTiempo({
        asignacion_id: Number(asignacionId),
        inicio: inicio.toISOString().slice(0, 19).replace('T', ' '),
        fin: fin.toISOString().slice(0, 19).replace('T', ' '),
        horas: Number(horasDecimal) > 0 ? Number(horasDecimal) : 0.05,
        tarifa_aplicada: this.tarifaHora,
        origen: 'TEMPORIZADOR'
      });

      window.App.mostrarToast(`¡Sesión guardada con éxito! +${horasDecimal} hrs registradas`, 'success');
      
      // Reiniciar contador y limpiar almacenamiento local
      this.segundos = 0;
      this.baseSegundos = 0;
      this.inicioTimestamp = null;
      this.limpiarStorage();
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