/**
 * Freelancer — Menú de Trabajadores:
 * 1. Panel de Rendimiento del Trabajador (Horas que lleva, Proyectos Completados, Proyectos Faltantes, Dinero Ganado según el tiempo)
 * 2. Dashboard Individual de cada Proyecto (Subir información/entregables al proyecto, registrar/ver horas y dinero ganado en el proyecto)
 * 3. Directorio de Especialistas con métricas en vivo
 */

const TalentoView = {
  subVista: 'PANEL', // 'PANEL' | 'PROYECTO_DASHBOARD' | 'DIRECTORIO'
  trabajadorSeleccionadoId: null,
  proyectoDashboardId: null,
  asignacionDashboardId: null,
  filtroEstadoProyecto: 'TODOS', // 'TODOS' | 'FALTANTES' | 'COMPLETADOS'
  filtroDisponibilidad: 'TODOS',
  busqueda: '',
  horasCalculadora: 8,
  debouncedSetBusqueda: null,

  init() {
    if (!this.debouncedSetBusqueda) {
      this.debouncedSetBusqueda = window.App.debounce((texto) => {
        this.busqueda = texto;
        this.render();
      }, 250);
    }

    const usuarioActivo = window.State.data.usuarioActivo;
    if (usuarioActivo && usuarioActivo.rol === 'TRABAJADOR') {
      this.trabajadorSeleccionadoId = Number(usuarioActivo.id);
    } else if (!this.trabajadorSeleccionadoId) {
      const trabajadores = window.State.data.trabajadores || [];
      const primeroConDatos = trabajadores.find(t => Number(t.usuario_id) === 8) || trabajadores[0];
      if (primeroConDatos) {
        this.trabajadorSeleccionadoId = Number(primeroConDatos.usuario_id);
      }
    }
  },

  obtenerFuentesDatos() {
    const panel = window.State.data.panelTrabajadores || {};
    const asignaciones = (panel.asignaciones && panel.asignaciones.length > 0)
      ? panel.asignaciones
      : (window.State.data.asignaciones || []);
    const registrosTiempo = (panel.registrosTiempo && panel.registrosTiempo.length > 0)
      ? panel.registrosTiempo
      : (window.State.data.registrosTiempo || []);
    const entregablesMap = panel.entregables || {};
    const proyectos = window.State.data.proyectos || [];
    const trabajadores = window.State.data.trabajadores || [];
    const usuarios = window.State.data.usuarios || [];

    return { asignaciones, registrosTiempo, entregablesMap, proyectos, trabajadores, usuarios };
  },

  calcularMetricasTrabajador(trabajadorId) {
    const { asignaciones, registrosTiempo, entregablesMap, proyectos } = this.obtenerFuentesDatos();
    const misAsignaciones = asignaciones.filter(a => Number(a.trabajador_id) === Number(trabajadorId));
    const idsAsignaciones = new Set(misAsignaciones.map(a => Number(a.id)));
    const misRegistros = registrosTiempo.filter(r => idsAsignaciones.has(Number(r.asignacion_id)));

    let horasTotales = 0;
    let horasPendientes = 0;
    let horasAprobadas = 0;
    let horasCongeladas = 0;
    let dineroTotalUSD = 0;
    let dineroConfirmadoUSD = 0;
    let dineroPendienteUSD = 0;

    misRegistros.forEach(r => {
      const asig = misAsignaciones.find(a => Number(a.id) === Number(r.asignacion_id));
      const h = Number(r.horas) || 0;
      const tarifa = Number(r.tarifa_aplicada || (asig && asig.tarifa_por_hora) || 70.0);
      const monto = h * tarifa;

      horasTotales += h;
      dineroTotalUSD += monto;

      if (r.estado === 'PENDIENTE') {
        horasPendientes += h;
        dineroPendienteUSD += monto;
      } else if (r.estado === 'APROBADO') {
        horasAprobadas += h;
        dineroConfirmadoUSD += monto;
      } else if (r.estado === 'CONGELADO') {
        horasCongeladas += h;
        dineroConfirmadoUSD += monto;
      }
    });

    const proyectosDetalle = misAsignaciones.map(asig => {
      const proy = proyectos.find(p => Number(p.id) === Number(asig.proyecto_id)) || {
        id: asig.proyecto_id,
        nombre_proyecto: `Proyecto #${asig.proyecto_id}`,
        descripcion: 'Proyecto asignado al trabajador.',
        tipo: 'TECNOLOGIA',
        estado: 'EN_CURSO',
        fecha_inicio: '2026-02-01'
      };
      const regsProy = misRegistros.filter(r => Number(r.asignacion_id) === Number(asig.id));
      let horasProy = 0;
      let dineroProy = 0;
      let horasAprobadasProy = 0;
      let horasPendientesProy = 0;

      regsProy.forEach(r => {
        const h = Number(r.horas) || 0;
        const t = Number(r.tarifa_aplicada || asig.tarifa_por_hora || 70.0);
        horasProy += h;
        dineroProy += (h * t);
        if (r.estado === 'PENDIENTE') horasPendientesProy += h;
        else horasAprobadasProy += h;
      });

      const entregablesProy = Array.isArray(entregablesMap[String(proy.id)]) ? entregablesMap[String(proy.id)] : [];
      const esCompletado = proy.estado === 'FINALIZADO';
      const ultimoProgreso = entregablesProy.length > 0
        ? Math.max(...entregablesProy.map(e => Number(e.progreso) || 0))
        : (esCompletado ? 100 : (horasProy > 0 ? Math.min(85, Math.round(horasProy * 4)) : 15));

      return {
        asignacion: asig,
        proyecto: proy,
        esCompletado,
        registros: regsProy,
        horasProy,
        horasAprobadasProy,
        horasPendientesProy,
        dineroProy,
        entregables: entregablesProy,
        porcentajeAvance: esCompletado ? 100 : ultimoProgreso
      };
    });

    const proyectosCompletados = proyectosDetalle.filter(p => p.esCompletado);
    const proyectosFaltantes = proyectosDetalle.filter(p => !p.esCompletado);
    const tarifaPromedio = misAsignaciones.length > 0
      ? misAsignaciones.reduce((acc, a) => acc + Number(a.tarifa_por_hora || 70), 0) / misAsignaciones.length
      : 70;

    return {
      misAsignaciones,
      misRegistros,
      horasTotales,
      horasPendientes,
      horasAprobadas,
      horasCongeladas,
      dineroTotalUSD,
      dineroConfirmadoUSD,
      dineroPendienteUSD,
      proyectosDetalle,
      proyectosCompletados,
      proyectosFaltantes,
      tarifaPromedio
    };
  },

  cambiarSubVista(nuevaSubVista) {
    this.subVista = nuevaSubVista;
    this.render();
  },

  seleccionarTrabajador(trabajadorId) {
    this.trabajadorSeleccionadoId = Number(trabajadorId);
    this.subVista = 'PANEL';
    this.render();
  },

  setFiltroEstadoProyecto(filtro) {
    this.filtroEstadoProyecto = filtro;
    this.render();
  },

  abrirDashboardProyecto(proyectoId, asignacionId = null) {
    this.proyectoDashboardId = Number(proyectoId);
    if (asignacionId) {
      this.asignacionDashboardId = Number(asignacionId);
      const { asignaciones } = this.obtenerFuentesDatos();
      const asig = asignaciones.find(a => Number(a.id) === Number(asignacionId));
      if (asig) {
        this.trabajadorSeleccionadoId = Number(asig.trabajador_id);
      }
    }
    this.subVista = 'PROYECTO_DASHBOARD';
    window.App.cambiarVista('talento');
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  actualizarCalculadora(horas) {
    if (horas !== undefined && horas !== null && horas !== '') {
      this.horasCalculadora = Math.max(0, Number(horas) || 0);
    }
    const elResultado = document.getElementById('calcDineroResultado');
    const elDesglose = document.getElementById('calcDineroDesglose');
    const selectTarifa = document.getElementById('calcTarifaProyectoSelect');
    const tarifa = selectTarifa ? Number(selectTarifa.value) || 70 : 70;
    const total = this.horasCalculadora * tarifa;
    if (elResultado) {
      elResultado.textContent = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
    }
    if (elDesglose) {
      elDesglose.textContent = `${this.horasCalculadora.toFixed(2)} hrs × $${tarifa.toFixed(2)}/h`;
    }
  },

  actualizarPreviewHoras(horas, tarifaHora) {
    const el = document.getElementById('proyDashMontoPreview');
    if (el) {
      el.textContent = '$' + (Math.max(0, Number(horas || 0)) * (Number(tarifaHora) || 0)).toFixed(2) + ' USD';
    }
  },

  render() {
    this.init();
    const container = document.getElementById('viewTalento');
    if (!container) return;

    const { trabajadores, usuarios } = this.obtenerFuentesDatos();
    const usuarioActivo = window.State.data.usuarioActivo;
    const esCliente = usuarioActivo && usuarioActivo.rol === 'CLIENTE';

    // Combinar datos de trabajadores
    const talentos = trabajadores.map(t => {
      const u = usuarios.find(usr => Number(usr.id) === Number(t.usuario_id));
      return {
        ...t,
        usuario_id: Number(t.usuario_id),
        nombre: (u && u.nombre) || t.nombre || `Especialista #${t.usuario_id}`,
        email: (u && u.email) || t.email || '',
        telefono: (u && u.telefono) || t.telefono || '',
        disponible: Boolean(t.disponibilidad === 1 || t.disponibilidad === true)
      };
    });

    if (!this.trabajadorSeleccionadoId && talentos.length > 0) {
      this.trabajadorSeleccionadoId = talentos[0].usuario_id;
    }

    const navSubMenu = `
      <!-- Barra de Navegación del Menú de Trabajadores -->
      <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-violet-200 dark:border-violet-800">
            <span class="material-symbols-outlined text-[15px]">engineering</span> Centro de Control de Trabajadores
          </span>
          <h2 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            ${this.subVista === 'PROYECTO_DASHBOARD'
              ? 'Dashboard Operativo del Proyecto'
              : (this.subVista === 'PANEL' ? 'Panel del Trabajador: Horas, Proyectos y Ganancias' : 'Directorio de Trabajadores')}
          </h2>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            data-csp-click="TalentoView.cambiarSubVista('PANEL')"
            class="${this.subVista === 'PANEL' || this.subVista === 'PROYECTO_DASHBOARD' ? 'btn-primary' : 'btn-secondary'} text-xs py-2 px-3">
            <span class="material-symbols-outlined text-[16px]">dashboard</span> Dashboard Trabajador & Proyectos
          </button>
          <button
            data-csp-click="TalentoView.cambiarSubVista('DIRECTORIO')"
            class="${this.subVista === 'DIRECTORIO' ? 'btn-primary' : 'btn-secondary'} text-xs py-2 px-3">
            <span class="material-symbols-outlined text-[16px]">groups</span> Directorio (${talentos.length})
          </button>
          ${esCliente ? `
            <button data-csp-click="window.App.abrirModalPublicarProyecto()" class="btn-secondary text-xs py-2 px-3">
              <span class="material-symbols-outlined text-[16px]">add_circle</span> Nuevo Proyecto
            </button>
          ` : ''}
        </div>
      </div>
    `;

    if (this.subVista === 'PROYECTO_DASHBOARD' && this.proyectoDashboardId) {
      container.innerHTML = navSubMenu + this.renderDashboardProyecto(talentos);
      return;
    }

    if (this.subVista === 'PANEL') {
      container.innerHTML = navSubMenu + this.renderPanelTrabajador(talentos);
      return;
    }

    container.innerHTML = navSubMenu + this.renderDirectorio(talentos, esCliente);
  },

  renderPanelTrabajador(talentos) {
    const trabajadorActual = talentos.find(t => Number(t.usuario_id) === Number(this.trabajadorSeleccionadoId)) || talentos[0];
    if (!trabajadorActual) {
      return `
        <div class="p-8 fl-card text-center">
          <p class="text-sm text-slate-500">No hay trabajadores registrados actualmente.</p>
        </div>
      `;
    }

    const metricas = this.calcularMetricasTrabajador(trabajadorActual.usuario_id);
    const totalProyectos = metricas.proyectosDetalle.length;
    const cantCompletados = metricas.proyectosCompletados.length;
    const cantFaltantes = metricas.proyectosFaltantes.length;
    const porcentajeProyectos = totalProyectos > 0 ? Math.round((cantCompletados / totalProyectos) * 100) : 0;

    let proyectosFiltrados = metricas.proyectosDetalle;
    if (this.filtroEstadoProyecto === 'COMPLETADOS') {
      proyectosFiltrados = metricas.proyectosCompletados;
    } else if (this.filtroEstadoProyecto === 'FALTANTES') {
      proyectosFiltrados = metricas.proyectosFaltantes;
    }

    const tarifaInicialCalc = metricas.proyectosDetalle[0]
      ? Number(metricas.proyectosDetalle[0].asignacion.tarifa_por_hora)
      : 70;
    const montoCalcInicial = this.horasCalculadora * tarifaInicialCalc;

    return `
      <!-- Selector de Trabajador y Perfil Activo -->
      <div class="fl-card p-5 mb-6 bg-gradient-to-r from-white to-violet-50/40 dark:from-slate-800 dark:to-slate-900">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-violet-700 text-white font-bold flex items-center justify-center text-lg font-mono shadow-md">
              ${window.App.escapeHTML(trabajadorActual.nombre.split(' ').map(n => n[0]).slice(0, 2).join(''))}
            </div>
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-lg font-bold text-slate-900 dark:text-white">${window.App.escapeHTML(trabajadorActual.nombre)}</h3>
                <span class="${trabajadorActual.disponible ? 'badge-success' : 'badge-warning'} text-[10px]">
                  ${trabajadorActual.disponible ? 'Disponible' : 'En Sprint'}
                </span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">${window.App.escapeHTML(trabajadorActual.especialidad || 'Especialista Freelance')}</p>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center gap-2">
            <label class="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">Ver panel del trabajador:</label>
            <select
              data-csp-change="TalentoView.seleccionarTrabajador(this.value)"
              class="text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-violet-600">
              ${talentos.map(t => {
                const m = this.calcularMetricasTrabajador(t.usuario_id);
                return `
                  <option value="${t.usuario_id}" ${Number(t.usuario_id) === Number(trabajadorActual.usuario_id) ? 'selected' : ''}>
                    ${window.App.escapeHTML(t.nombre)} — ${m.horasTotales.toFixed(1)}h · $${m.dineroTotalUSD.toFixed(0)} USD (${m.proyectosDetalle.length} proy.)
                  </option>
                `;
              }).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- 4 Tarjetas KPI: Horas que lleva, Dinero Ganado, Proyectos Completados y Proyectos Faltantes -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <!-- 1. Horas que lleva -->
        <div class="fl-card p-5 bg-gradient-to-br from-white to-violet-50/50 dark:from-slate-800 dark:to-violet-950/20">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Horas que Lleva</span>
            <span class="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 material-symbols-outlined text-[20px]">schedule</span>
          </div>
          <div class="text-3xl font-bold text-slate-900 dark:text-white font-mono">
            ${metricas.horasTotales.toFixed(2)} <span class="text-xs font-sans font-normal text-slate-500">hrs</span>
          </div>
          <div class="mt-2 text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap gap-2 font-mono">
            <span class="text-emerald-700 dark:text-emerald-400 font-semibold">✓ ${(metricas.horasAprobadas + metricas.horasCongeladas).toFixed(2)}h aprobadas</span>
            <span>•</span>
            <span class="text-amber-700 dark:text-amber-400 font-semibold">⏳ ${metricas.horasPendientes.toFixed(2)}h pendientes</span>
          </div>
        </div>

        <!-- 2. Dinero ganado dependiendo del tiempo -->
        <div class="fl-card p-5 bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-800 dark:to-emerald-950/20">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Dinero Ganado (Tiempo × Tarifa)</span>
            <span class="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 material-symbols-outlined text-[20px]">payments</span>
          </div>
          <div class="text-3xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">
            $${metricas.dineroTotalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span class="text-xs font-sans font-normal text-slate-500">USD</span>
          </div>
          <div class="mt-2 text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap gap-2 font-mono">
            <span class="text-emerald-700 dark:text-emerald-400 font-semibold">Aprobado: $${metricas.dineroConfirmadoUSD.toFixed(2)}</span>
            <span>•</span>
            <span class="text-amber-700 dark:text-amber-400">En revisión: $${metricas.dineroPendienteUSD.toFixed(2)}</span>
          </div>
        </div>

        <!-- 3. Proyectos Completados -->
        <div class="fl-card p-5 bg-gradient-to-br from-white to-indigo-50/50 dark:from-slate-800 dark:to-indigo-950/20">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Proyectos Completados</span>
            <span class="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 material-symbols-outlined text-[20px]">task_alt</span>
          </div>
          <div class="text-3xl font-bold text-indigo-900 dark:text-indigo-300 font-mono">
            ${cantCompletados} <span class="text-xs font-sans font-normal text-slate-500">de ${totalProyectos} proyectos</span>
          </div>
          <div class="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Tasa de finalización:</span>
            <span class="font-mono font-bold text-indigo-700 dark:text-indigo-400">${porcentajeProyectos}%</span>
          </div>
        </div>

        <!-- 4. Proyectos Faltantes / En Curso -->
        <div class="fl-card p-5 bg-gradient-to-br from-white to-amber-50/50 dark:from-slate-800 dark:to-amber-950/20">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Proyectos Faltantes (En Curso)</span>
            <span class="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 material-symbols-outlined text-[20px]">pending_actions</span>
          </div>
          <div class="text-3xl font-bold text-amber-800 dark:text-amber-400 font-mono">
            ${cantFaltantes} <span class="text-xs font-sans font-normal text-slate-500">pendientes por terminar</span>
          </div>
          <div class="mt-2 text-[11px] text-slate-500">
            Haz clic en cada proyecto para subir avances o completarlo
          </div>
        </div>
      </div>

      <!-- Simulador / Calculadora Rápida de Dinero según el Tiempo Trabajado -->
      <div class="fl-card p-4 mb-8 border-l-4 border-l-violet-600">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h4 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[18px] text-violet-700">calculate</span>
              Calculadora de Ganancias según el Tiempo Trabajado
            </h4>
            <p class="text-xs text-slate-500">Simula cuánto dinero gana ${window.App.escapeHTML(trabajadorActual.nombre)} según las horas dedicadas a cada proyecto.</p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <div>
              <label class="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Horas de trabajo</label>
              <input
                type="number"
                min="0.25"
                step="0.25"
                value="${this.horasCalculadora}"
                data-csp-input="TalentoView.actualizarCalculadora(this.value)"
                class="w-24 p-2 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700"
              />
            </div>

            <div>
              <label class="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Proyecto / Tarifa</label>
              <select
                id="calcTarifaProyectoSelect"
                data-csp-change="TalentoView.actualizarCalculadora()"
                class="p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium">
                ${metricas.proyectosDetalle.length > 0 ? metricas.proyectosDetalle.map(p => `
                  <option value="${p.asignacion.tarifa_por_hora}">
                    ${window.App.escapeHTML(p.proyecto.nombre_proyecto.slice(0, 32))} ($${Number(p.asignacion.tarifa_por_hora).toFixed(2)}/h)
                  </option>
                `).join('') : `<option value="70">Tarifa estándar ($70.00/h)</option>`}
              </select>
            </div>

            <div class="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3.5 py-1.5 rounded-xl text-right">
              <span id="calcDineroDesglose" class="block text-[10px] font-mono text-slate-500">${this.horasCalculadora.toFixed(2)} hrs × $${tarifaInicialCalc.toFixed(2)}/h</span>
              <span id="calcDineroResultado" class="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400">
                $${montoCalcInicial.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sección de Proyectos del Trabajador (Completados vs Faltantes + Acceso al Dashboard de cada Proyecto) -->
      <div class="mb-8">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span class="material-symbols-outlined text-violet-700">folder_managed</span>
            Proyectos Asignados a ${window.App.escapeHTML(trabajadorActual.nombre)}
          </h3>

          <div class="flex items-center gap-2">
            ${[
              { id: 'TODOS', label: `Todos (${totalProyectos})` },
              { id: 'FALTANTES', label: `Faltantes / En Curso (${cantFaltantes})` },
              { id: 'COMPLETADOS', label: `Completados (${cantCompletados})` }
            ].map(tab => `
              <button
                data-csp-click="TalentoView.setFiltroEstadoProyecto('${tab.id}')"
                class="px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  this.filtroEstadoProyecto === tab.id
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }">
                ${tab.label}
              </button>
            `).join('')}
          </div>
        </div>

        ${proyectosFiltrados.length === 0 ? `
          <div class="p-8 fl-card text-center">
            <p class="text-xs text-slate-500">No hay proyectos en este filtro para este trabajador.</p>
          </div>
        ` : `
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            ${proyectosFiltrados.map(item => {
              const { asignacion, proyecto, esCompletado, horasProy, dineroProy, entregables, porcentajeAvance } = item;
              return `
                <div class="fl-card p-5 flex flex-col justify-between">
                  <div>
                    <div class="flex items-start justify-between gap-2 mb-3">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="badge-tech text-[10px] font-mono uppercase">${window.App.escapeHTML(proyecto.tipo || 'PROYECTO')}</span>
                        <span class="${esCompletado ? 'badge-success' : 'badge-warning'} text-[10px]">
                          ${esCompletado ? '✓ COMPLETADO (FINALIZADO)' : '⏳ FALTANTE / EN CURSO'}
                        </span>
                      </div>
                      <span class="text-xs font-mono font-bold text-violet-700 dark:text-violet-400">
                        $${Number(asignacion.tarifa_por_hora).toFixed(2)} / hr
                      </span>
                    </div>

                    <h4 class="text-base font-bold text-slate-900 dark:text-white mb-1 leading-snug">
                      ${window.App.escapeHTML(proyecto.nombre_proyecto)}
                    </h4>
                    <p class="text-xs text-slate-500 mb-3 line-clamp-3">
                      ${window.App.escapeHTML(proyecto.descripcion || 'Sin descripción adicional.')}
                    </p>

                    <!-- Barra de Progreso del Proyecto -->
                    <div class="mb-4">
                      <div class="flex items-center justify-between text-[11px] mb-1">
                        <span class="font-semibold text-slate-600 dark:text-slate-300">Avance del Proyecto (${entregables.length} entregas subidas)</span>
                        <span class="font-mono font-bold text-violet-700 dark:text-violet-400">${porcentajeAvance}%</span>
                      </div>
                      <div class="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div class="h-2 ${esCompletado ? 'bg-emerald-500' : 'bg-violet-600'} rounded-full" style="width: ${porcentajeAvance}%"></div>
                      </div>
                    </div>

                    <!-- Resumen de Horas y Dinero Ganado en este Proyecto -->
                    <div class="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 text-xs mb-4 font-mono">
                      <div>
                        <span class="text-[10px] font-sans uppercase text-slate-400 block">Horas Registradas</span>
                        <span class="font-bold text-slate-900 dark:text-white">${horasProy.toFixed(2)} hrs</span>
                      </div>
                      <div>
                        <span class="text-[10px] font-sans uppercase text-slate-400 block">Dinero Ganado</span>
                        <span class="font-bold text-emerald-700 dark:text-emerald-400">$${dineroProy.toFixed(2)} USD</span>
                      </div>
                      <div>
                        <span class="text-[10px] font-sans uppercase text-slate-400 block">Rol Asignado</span>
                        <span class="font-sans font-semibold text-slate-800 dark:text-slate-200 truncate block">${window.App.escapeHTML(asignacion.rol_en_proyecto)}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Botones de Acción: Abrir Dashboard del Proyecto y Cambiar Estado -->
                  <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <button
                      data-csp-click="TalentoView.cambiarEstadoProyecto(${proyecto.id}, '${esCompletado ? 'EN_CURSO' : 'FINALIZADO'}')"
                      class="btn-secondary text-xs py-1.5 px-3">
                      <span class="material-symbols-outlined text-[15px]">${esCompletado ? 'replay' : 'check_circle'}</span>
                      ${esCompletado ? 'Marcar como En Curso' : 'Marcar como Completado'}
                    </button>

                    <button
                      data-csp-click="TalentoView.abrirDashboardProyecto(${proyecto.id}, ${asignacion.id})"
                      class="btn-primary text-xs py-1.5 px-3.5">
                      <span class="material-symbols-outlined text-[16px]">space_dashboard</span>
                      Abrir Dashboard & Subir Info
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Tabla de Horas Registradas y Dinero Ganado del Trabajador -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span class="material-symbols-outlined text-emerald-700">payments</span>
            Desglose de Horas Registradas y Dinero Ganado por Tiempo
          </h3>
          <span class="text-xs font-mono text-slate-500">${metricas.misRegistros.length} sesiones registradas</span>
        </div>

        ${metricas.misRegistros.length === 0 ? `
          <div class="p-8 fl-card text-center">
            <p class="text-xs text-slate-500">Este trabajador aún no tiene sesiones de horas registradas. Abre el Dashboard de un proyecto para registrar tiempo.</p>
          </div>
        ` : `
          <div class="fl-card overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                  <tr>
                    <th class="py-3 px-4">Registro</th>
                    <th class="py-3 px-4">Proyecto</th>
                    <th class="py-3 px-4">Fecha / Intervalo</th>
                    <th class="py-3 px-4">Tiempo (Horas)</th>
                    <th class="py-3 px-4">Tarifa Aplicada</th>
                    <th class="py-3 px-4">Dinero Ganado</th>
                    <th class="py-3 px-4">Origen</th>
                    <th class="py-3 px-4">Estado</th>
                    <th class="py-3 px-4 text-right">Proyecto</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  ${metricas.misRegistros.map(reg => {
                    const itemProy = metricas.proyectosDetalle.find(p => Number(p.asignacion.id) === Number(reg.asignacion_id));
                    const nombreProy = itemProy ? itemProy.proyecto.nombre_proyecto : `Asignación #${reg.asignacion_id}`;
                    const tarifa = Number(reg.tarifa_aplicada || (itemProy && itemProy.asignacion.tarifa_por_hora) || 70.0);
                    const ganado = (Number(reg.horas) * tarifa).toFixed(2);
                    const fechaStr = reg.inicio ? new Date(reg.inicio).toLocaleDateString() : 'N/A';

                    let badge = 'badge-warning';
                    if (reg.estado === 'APROBADO') badge = 'badge-success';
                    if (reg.estado === 'CONGELADO') badge = 'badge-tech';

                    return `
                      <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                        <td class="py-3 px-4 text-slate-400">#${reg.id}</td>
                        <td class="py-3 px-4 font-sans font-semibold text-slate-900 dark:text-white max-w-[220px] truncate">
                          ${window.App.escapeHTML(nombreProy)}
                        </td>
                        <td class="py-3 px-4 text-slate-600 dark:text-slate-300">${fechaStr}</td>
                        <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${Number(reg.horas).toFixed(2)} hrs</td>
                        <td class="py-3 px-4 text-slate-600 dark:text-slate-300">$${tarifa.toFixed(2)}/h</td>
                        <td class="py-3 px-4 font-bold text-emerald-700 dark:text-emerald-400">+$${ganado} USD</td>
                        <td class="py-3 px-4 font-sans">${window.App.escapeHTML(reg.origen)}</td>
                        <td class="py-3 px-4 font-sans"><span class="${badge} text-[10px]">${window.App.escapeHTML(reg.estado)}</span></td>
                        <td class="py-3 px-4 text-right font-sans">
                          ${itemProy ? `
                            <button data-csp-click="TalentoView.abrirDashboardProyecto(${itemProy.proyecto.id}, ${itemProy.asignacion.id})" class="text-violet-700 dark:text-violet-400 font-semibold hover:underline">
                              Ver Proyecto
                            </button>
                          ` : '—'}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `}
      </div>
    `;
  },

  renderDashboardProyecto(talentos) {
    const { asignaciones, registrosTiempo, entregablesMap, proyectos, usuarios } = this.obtenerFuentesDatos();
    const proy = proyectos.find(p => Number(p.id) === Number(this.proyectoDashboardId));
    const asig = this.asignacionDashboardId
      ? asignaciones.find(a => Number(a.id) === Number(this.asignacionDashboardId))
      : asignaciones.find(a => Number(a.proyecto_id) === Number(this.proyectoDashboardId));

    if (!proy && !asig) {
      return `
        <div class="p-8 fl-card text-center">
          <p class="text-sm text-slate-500 mb-3">No se encontró el proyecto solicitado.</p>
          <button data-csp-click="TalentoView.cambiarSubVista('PANEL')" class="btn-primary text-xs">Volver al Panel del Trabajador</button>
        </div>
      `;
    }

    const proyectoActual = proy || {
      id: this.proyectoDashboardId,
      nombre_proyecto: `Proyecto #${this.proyectoDashboardId}`,
      descripcion: 'Proyecto activo asignado.',
      tipo: 'TECNOLOGIA',
      estado: 'EN_CURSO',
      fecha_inicio: '2026-02-01'
    };

    const trabajador = asig
      ? (talentos.find(t => Number(t.usuario_id) === Number(asig.trabajador_id)) || { nombre: `Trabajador #${asig.trabajador_id}`, usuario_id: asig.trabajador_id })
      : (talentos.find(t => Number(t.usuario_id) === Number(this.trabajadorSeleccionadoId)) || { nombre: 'Especialista', usuario_id: 8 });

    const regsProy = asig
      ? registrosTiempo.filter(r => Number(r.asignacion_id) === Number(asig.id))
      : [];

    const tarifaHora = Number((asig && asig.tarifa_por_hora) || 70.0);
    let totalHorasProy = 0;
    let totalDineroProy = 0;
    let horasAprobadasProy = 0;
    let horasPendientesProy = 0;

    regsProy.forEach(r => {
      const h = Number(r.horas) || 0;
      const t = Number(r.tarifa_aplicada || tarifaHora);
      totalHorasProy += h;
      totalDineroProy += (h * t);
      if (r.estado === 'PENDIENTE') horasPendientesProy += h;
      else horasAprobadasProy += h;
    });

    const entregables = Array.isArray(entregablesMap[String(proyectoActual.id)])
      ? entregablesMap[String(proyectoActual.id)]
      : [];
    const esCompletado = proyectoActual.estado === 'FINALIZADO';
    const avanceActual = esCompletado
      ? 100
      : (entregables.length > 0 ? Math.max(...entregables.map(e => Number(e.progreso) || 0)) : 50);
    const timerActivo = Boolean(asig && asig.temporizador_inicio);

    return `
      <!-- Botón Volver y Cabecera del Dashboard del Proyecto -->
      <div class="mb-4">
        <button data-csp-click="TalentoView.cambiarSubVista('PANEL')" class="btn-secondary text-xs py-1.5 px-3">
          <span class="material-symbols-outlined text-[16px]">arrow_back</span> Volver al Panel del Trabajador (${window.App.escapeHTML(trabajador.nombre)})
        </button>
      </div>

      <div class="fl-card p-6 mb-6">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <span class="badge-tech text-xs font-mono uppercase">${window.App.escapeHTML(proyectoActual.tipo || 'GENERAL')}</span>
              <span class="${esCompletado ? 'badge-success' : 'badge-warning'} text-xs">
                ${esCompletado ? '✓ PROYECTO COMPLETADO (FINALIZADO)' : '⏳ PROYECTO EN CURSO / FALTANTE'}
              </span>
              <span class="text-xs font-mono text-slate-400">ID Proyecto #${proyectoActual.id}</span>
            </div>
            <h3 class="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-snug">
              ${window.App.escapeHTML(proyectoActual.nombre_proyecto)}
            </h3>
            <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-3xl">
              ${window.App.escapeHTML(proyectoActual.descripcion || '')}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              data-csp-click="TalentoView.cambiarEstadoProyecto(${proyectoActual.id}, '${esCompletado ? 'EN_CURSO' : 'FINALIZADO'}')"
              class="${esCompletado ? 'btn-secondary' : 'btn-primary'} text-xs">
              <span class="material-symbols-outlined text-[16px]">${esCompletado ? 'replay' : 'task_alt'}</span>
              ${esCompletado ? 'Reabrir como En Curso' : 'Marcar Proyecto como Completado'}
            </button>
          </div>
        </div>

        <!-- 4 Métricas Clave del Proyecto -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
            <span class="text-[10px] font-bold uppercase text-slate-400 block">Trabajador Asignado</span>
            <span class="text-sm font-bold text-slate-900 dark:text-white block mt-0.5">${window.App.escapeHTML(trabajador.nombre)}</span>
            <span class="text-xs text-violet-700 dark:text-violet-400 font-medium">${window.App.escapeHTML((asig && asig.rol_en_proyecto) || 'Especialista Senior')}</span>
          </div>

          <div class="p-4 rounded-xl bg-violet-50/60 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-800">
            <span class="text-[10px] font-bold uppercase text-slate-500 block">Horas Registradas en Proyecto</span>
            <span class="text-2xl font-bold font-mono text-slate-900 dark:text-white">${totalHorasProy.toFixed(2)} hrs</span>
            <span class="text-[11px] font-mono text-slate-500 block">${horasAprobadasProy.toFixed(1)}h aprobadas · ${horasPendientesProy.toFixed(1)}h pend.</span>
          </div>

          <div class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
            <span class="text-[10px] font-bold uppercase text-slate-500 block">Dinero Ganado en este Proyecto</span>
            <span class="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">$${totalDineroProy.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
            <span class="text-[11px] font-mono text-slate-500 block">Tarifa: $${tarifaHora.toFixed(2)} USD / hora</span>
          </div>

          <div class="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
            <span class="text-[10px] font-bold uppercase text-slate-500 block">Avance & Información Subida</span>
            <span class="text-2xl font-bold font-mono text-indigo-800 dark:text-indigo-300">${avanceActual}%</span>
            <span class="text-[11px] text-slate-500 block">${entregables.length} actualización(es) / archivos</span>
          </div>
        </div>
      </div>

      <!-- Dos Columnas del Dashboard del Proyecto: 1. Subir Información y Entregables | 2. Registrar Horas y Ver Dinero Ganado -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        <!-- COLUMNA IZQUIERDA: SUBIR INFORMACIÓN / AVANCES / ARCHIVOS AL PROYECTO -->
        <div class="space-y-6">
          <div class="fl-card p-6">
            <h4 class="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <span class="material-symbols-outlined text-violet-700">upload_file</span>
              Subir Información, Entregables o Avances al Proyecto
            </h4>
            <p class="text-xs text-slate-500 mb-4">
              Registra documentación técnica, enlaces a repositorios, prototipos, archivos entregables y porcentaje de avance del proyecto.
            </p>

            <form data-csp-submit="TalentoView.guardarEntregableProyecto(event, ${proyectoActual.id}, ${trabajador.usuario_id}, '${window.App.escapeHTML(trabajador.nombre)}')" class="space-y-3.5">
              <div>
                <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Título del Avance o Entregable *</label>
                <input
                  id="entregableTituloInput"
                  type="text"
                  required
                  placeholder="Ej. Entrega de endpoints REST, Prototipo en Figma, Reporte QA..."
                  class="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-violet-600"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tipo de Información</label>
                  <select id="entregableTipoSelect" class="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <option value="AVANCE DE SPRINT">Avance de Sprint</option>
                    <option value="CÓDIGO / REPOSITORIO">Código / Repositorio Git</option>
                    <option value="DISEÑO / PROTOTIPO">Diseño / Prototipo UI</option>
                    <option value="DOCUMENTACIÓN / INFORME">Documentación / Informe Técnico</option>
                    <option value="ENTREGABLE FINAL">Entregable Final del Proyecto</option>
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Porcentaje de Avance (%)</label>
                  <input
                    id="entregableProgresoInput"
                    type="number"
                    min="0"
                    max="100"
                    value="${Math.min(100, avanceActual + 10)}"
                    required
                    class="w-full p-2.5 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">URL / Enlace del Recurso (Opcional)</label>
                  <input
                    id="entregableUrlInput"
                    type="url"
                    placeholder="https://github.com/... o https://figma.com/..."
                    class="w-full p-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Adjuntar Archivo / Evidencia (Opcional)</label>
                  <input
                    id="entregableArchivoInput"
                    type="file"
                    class="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Descripción Detallada de la Información Subida *</label>
                <textarea
                  id="entregableDescInput"
                  rows="3"
                  required
                  placeholder="Describe los cambios realizados, instrucciones de revisión, credenciales de prueba o notas para el cliente..."
                  class="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-violet-600"></textarea>
              </div>

              <div class="pt-2 flex justify-end">
                <button type="submit" class="btn-primary text-xs">
                  <span class="material-symbols-outlined text-[16px]">cloud_upload</span> Subir Información al Proyecto
                </button>
              </div>
            </form>
          </div>

          <!-- Historial de Información y Entregables Subidos al Proyecto -->
          <div class="fl-card p-6">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span class="material-symbols-outlined text-indigo-600">inventory_2</span>
                Información y Entregables Subidos (${entregables.length})
              </h4>
            </div>

            ${entregables.length === 0 ? `
              <div class="p-6 text-center bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <p class="text-xs text-slate-500">Aún no se ha subido información a este proyecto. Usa el formulario superior para registrar el primer avance.</p>
              </div>
            ` : `
              <div class="space-y-3">
                ${entregables.map(ent => `
                  <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
                    <div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <span class="badge-tech text-[10px] font-mono">${window.App.escapeHTML(ent.tipo_entrega)}</span>
                      <div class="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                        <span class="font-bold text-emerald-700 dark:text-emerald-400">Avance: ${Number(ent.progreso || 0)}%</span>
                        <span>•</span>
                        <span>${window.App.escapeHTML(ent.fecha || 'Reciente')}</span>
                      </div>
                    </div>

                    <h5 class="text-sm font-bold text-slate-900 dark:text-white mb-1">${window.App.escapeHTML(ent.titulo)}</h5>
                    <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
                      ${window.App.escapeHTML(ent.descripcion)}
                    </p>

                    <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px]">
                      <span class="text-slate-500">Subido por: <strong class="text-slate-800 dark:text-white">${window.App.escapeHTML(ent.autor_nombre || trabajador.nombre)}</strong></span>
                      <div class="flex flex-wrap items-center gap-3 font-mono">
                        ${ent.archivo_nombre ? `
                          <span class="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                            <span class="material-symbols-outlined text-[14px] text-violet-700">attach_file</span>
                            ${window.App.escapeHTML(ent.archivo_nombre)}
                          </span>
                        ` : ''}
                        ${ent.url_recurso ? `
                          <a href="${window.App.escapeHTML(ent.url_recurso)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-violet-700 dark:text-violet-400 font-bold hover:underline">
                            <span class="material-symbols-outlined text-[14px]">open_in_new</span> Abrir Enlace
                          </a>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- COLUMNA DERECHA: REGISTRAR HORAS EN EL PROYECTO Y VER DINERO GANADO SEGÚN TIEMPO -->
        <div class="space-y-6">
          ${asig ? `
            <div class="fl-card p-6">
              <div class="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h4 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span class="material-symbols-outlined text-emerald-600">timer</span>
                    Registrar Tiempo y Calcular Ganancia en el Proyecto
                  </h4>
                  <p class="text-xs text-slate-500 mt-0.5">
                    Asignación #${asig.id} • Tarifa acordada: <strong class="font-mono text-emerald-700 dark:text-emerald-400">$${tarifaHora.toFixed(2)} USD / hora</strong>
                  </p>
                </div>

                <div>
                  ${timerActivo ? `
                    <button data-csp-click="WorkspaceView.detenerTemporizadorServidor(${asig.id})" class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1">
                      <span class="material-symbols-outlined text-[15px]">stop_circle</span> Detener Temporizador
                    </button>
                  ` : `
                    <button data-csp-click="WorkspaceView.iniciarTemporizadorServidor(${asig.id})" class="btn-secondary text-xs py-1.5 px-3">
                      <span class="material-symbols-outlined text-[15px]">play_circle</span> Iniciar Temporizador
                    </button>
                  `}
                </div>
              </div>

              <form data-csp-submit="TalentoView.registrarHorasEnProyecto(event, ${asig.id}, ${tarifaHora})" class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Horas Trabajadas *</label>
                    <input
                      id="proyDashHorasInput"
                      type="number"
                      step="0.25"
                      min="0.25"
                      max="24"
                      value="4"
                      required
                      data-csp-input="TalentoView.actualizarPreviewHoras(this.value, ${tarifaHora})"
                      class="w-full p-2.5 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Dinero Generado por este Tiempo</label>
                    <div id="proyDashMontoPreview" class="p-2.5 text-sm font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      $${(4 * tarifaHora).toFixed(2)} USD
                    </div>
                  </div>
                </div>

                <div class="flex justify-end">
                  <button type="submit" class="btn-primary text-xs">
                    <span class="material-symbols-outlined text-[16px]">add_alarm</span> Registrar Horas en este Proyecto
                  </button>
                </div>
              </form>
            </div>
          ` : ''}

          <!-- Tabla de Sesiones de Tiempo y Dinero Ganado en este Proyecto -->
          <div class="fl-card p-6">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span class="material-symbols-outlined text-violet-700">history</span>
                Horas Registradas y Dinero Ganado en este Proyecto
              </h4>
              <span class="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                Total: ${totalHorasProy.toFixed(2)}h = $${totalDineroProy.toFixed(2)} USD
              </span>
            </div>

            ${regsProy.length === 0 ? `
              <div class="p-6 text-center bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                <p class="text-xs text-slate-500">Aún no hay horas registradas para este proyecto.</p>
              </div>
            ` : `
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase">
                    <tr>
                      <th class="py-2.5 px-3">ID</th>
                      <th class="py-2.5 px-3">Fecha</th>
                      <th class="py-2.5 px-3">Horas</th>
                      <th class="py-2.5 px-3">Tarifa</th>
                      <th class="py-2.5 px-3">Dinero Ganado</th>
                      <th class="py-2.5 px-3">Origen</th>
                      <th class="py-2.5 px-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    ${regsProy.map(r => {
                      const t = Number(r.tarifa_aplicada || tarifaHora);
                      const sub = (Number(r.horas) * t).toFixed(2);
                      const f = r.inicio ? new Date(r.inicio).toLocaleDateString() : 'N/A';
                      let b = 'badge-warning';
                      if (r.estado === 'APROBADO') b = 'badge-success';
                      if (r.estado === 'CONGELADO') b = 'badge-tech';
                      return `
                        <tr>
                          <td class="py-2.5 px-3 text-slate-400">#${r.id}</td>
                          <td class="py-2.5 px-3 text-slate-600 dark:text-slate-300">${f}</td>
                          <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-white">${Number(r.horas).toFixed(2)} h</td>
                          <td class="py-2.5 px-3 text-slate-500">$${t.toFixed(2)}/h</td>
                          <td class="py-2.5 px-3 font-bold text-emerald-700 dark:text-emerald-400">+$${sub} USD</td>
                          <td class="py-2.5 px-3 font-sans">${window.App.escapeHTML(r.origen)}</td>
                          <td class="py-2.5 px-3 font-sans"><span class="${b} text-[10px]">${window.App.escapeHTML(r.estado)}</span></td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  },

  renderDirectorio(talentos, esCliente) {
    const filtrados = talentos.filter(t => {
      const coincideDisp = this.filtroDisponibilidad === 'TODOS'
        ? true
        : (this.filtroDisponibilidad === 'DISPONIBLE' ? t.disponible : !t.disponible);
      const texto = `${t.nombre || ''} ${t.especialidad || ''}`.toLowerCase();
      const coincideBusqueda = !this.busqueda || texto.includes(this.busqueda.toLowerCase());
      return coincideDisp && coincideBusqueda;
    });

    return `
      <!-- Filtros y Búsqueda del Directorio -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-2">
          ${[
            { id: 'TODOS', label: 'Todos los Trabajadores' },
            { id: 'DISPONIBLE', label: 'Disponibles Ahora' },
            { id: 'OCUPADO', label: 'En Proyecto' }
          ].map(f => `
            <button
              data-csp-click="TalentoView.setFiltro('${f.id}')"
              class="px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                this.filtroDisponibilidad === f.id
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }">
              ${f.label}
            </button>
          `).join('')}
        </div>

        <div class="relative w-full sm:w-72">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
          <input
            type="text"
            value="${window.App.escapeHTML(this.busqueda)}"
            data-csp-input="TalentoView.debouncedSetBusqueda(this.value)"
            placeholder="Buscar por nombre o habilidad..."
            class="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-violet-600"
          />
        </div>
      </div>

      ${filtrados.length === 0 ? `
        <div class="text-center py-16 bg-white dark:bg-slate-800/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8">
          <h3 class="text-base font-bold text-slate-800 dark:text-white">No se encontraron especialistas</h3>
          <div class="mt-4">
            <button data-csp-click="TalentoView.limpiarFiltros()" class="btn-secondary text-xs">Mostrar Todos</button>
          </div>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          ${filtrados.map(talento => {
            const iniciales = talento.nombre.split(' ').map(n => n[0]).slice(0, 2).join('');
            const skills = (talento.especialidad || '').split('·').map(s => s.trim());
            const rolPrincipal = skills[0] || 'Especialista Freelance';
            const tags = skills[1] ? skills[1].split(',').map(tag => tag.trim()) : [];
            const m = this.calcularMetricasTrabajador(talento.usuario_id);

            return `
              <div class="fl-card p-5 flex flex-col justify-between">
                <div>
                  <div class="flex items-start justify-between gap-3 mb-4">
                    <div class="flex items-center gap-3">
                      <div class="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-md font-mono">
                        ${window.App.escapeHTML(iniciales)}
                      </div>
                      <div>
                        <div class="flex items-center gap-1.5">
                          <h3 class="font-bold text-slate-900 dark:text-white text-base leading-snug">${window.App.escapeHTML(talento.nombre)}</h3>
                          <span class="material-symbols-outlined text-[16px] text-emerald-600" title="Verificado">verified</span>
                        </div>
                        <span class="text-xs text-slate-500 font-medium block truncate max-w-[180px]">${window.App.escapeHTML(rolPrincipal)}</span>
                      </div>
                    </div>

                    <span class="${talento.disponible ? 'badge-success' : 'badge-warning'} whitespace-nowrap">
                      ${talento.disponible ? 'Disponible' : 'En Proyecto'}
                    </span>
                  </div>

                  <!-- Resumen de Horas, Proyectos y Dinero Ganado en la tarjeta del trabajador -->
                  <div class="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3 mb-4 border border-slate-100 dark:border-slate-700 text-xs font-mono">
                    <div>
                      <span class="text-slate-400 font-sans block text-[10px] uppercase">Horas</span>
                      <span class="font-bold text-slate-900 dark:text-white">${m.horasTotales.toFixed(1)}h</span>
                    </div>
                    <div>
                      <span class="text-slate-400 font-sans block text-[10px] uppercase">Proyectos</span>
                      <span class="font-bold text-indigo-700 dark:text-indigo-400">${m.proyectosCompletados.length}✓ / ${m.proyectosFaltantes.length}⏳</span>
                    </div>
                    <div>
                      <span class="text-slate-400 font-sans block text-[10px] uppercase">Ganado</span>
                      <span class="font-bold text-emerald-700 dark:text-emerald-400">$${m.dineroTotalUSD.toFixed(0)}</span>
                    </div>
                  </div>

                  <div class="flex flex-wrap gap-1.5 mb-4">
                    ${tags.slice(0, 4).map(tg => `
                      <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-mono border border-slate-200 dark:border-slate-700">
                        ${window.App.escapeHTML(tg)}
                      </span>
                    `).join('')}
                  </div>
                </div>

                <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button data-csp-click="TalentoView.seleccionarTrabajador(${talento.usuario_id})" class="btn-primary text-xs py-1.5 px-3">
                    <span class="material-symbols-outlined text-[15px]">dashboard</span> Ver Dashboard & Proyectos
                  </button>
                  ${esCliente ? `
                    <button data-csp-click="TalentoView.asignarDirecto(${talento.usuario_id})" class="btn-secondary text-xs py-1.5 px-3">
                      Contratar
                    </button>
                  ` : `
                    <button data-csp-click="TalentoView.verPerfil(${talento.usuario_id})" class="text-xs text-violet-700 dark:text-violet-400 font-semibold hover:underline">
                      Ficha
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  },

  async guardarEntregableProyecto(event, proyectoId, trabajadorId, autorNombre) {
    event.preventDefault();
    const titulo = document.getElementById('entregableTituloInput').value.trim();
    const tipo_entrega = document.getElementById('entregableTipoSelect').value;
    const progreso = Number(document.getElementById('entregableProgresoInput').value || 0);
    const url_recurso = document.getElementById('entregableUrlInput').value.trim();
    const fileInput = document.getElementById('entregableArchivoInput');
    const descripcion = document.getElementById('entregableDescInput').value.trim();

    let archivo_nombre = null;
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const f = fileInput.files[0];
      const kb = Math.max(1, Math.round(f.size / 1024));
      archivo_nombre = `${f.name} (${kb} KB)`;
    }

    try {
      window.App.mostrarToast('Subiendo información al proyecto...', 'info');
      await window.API.subirEntregableProyecto(proyectoId, {
        trabajador_id: trabajadorId,
        autor_nombre: autorNombre,
        titulo,
        tipo_entrega,
        progreso,
        url_recurso: url_recurso || null,
        archivo_nombre,
        descripcion
      });

      if (progreso >= 100) {
        try {
          await window.API.actualizarEstadoProyecto(proyectoId, 'FINALIZADO');
        } catch (e) {}
      }

      window.App.mostrarToast('¡Información y avance registrados exitosamente en el proyecto!', 'success');
      await window.State.recargarTodo();
    } catch (error) {
      window.App.mostrarToast(`No se pudo subir la información: ${error.message}`, 'error');
    }
  },

  async registrarHorasEnProyecto(event, asignacionId, tarifaHora) {
    event.preventDefault();
    const horasInput = document.getElementById('proyDashHorasInput');
    const horas = Number(horasInput ? horasInput.value : 0);
    if (!horas || horas <= 0) {
      window.App.mostrarToast('Ingresa una cantidad de horas mayor a 0.', 'warning');
      return;
    }

    const ahora = new Date();
    const antes = new Date(ahora.getTime() - horas * 3600 * 1000);

    try {
      window.App.mostrarToast('Registrando horas en la base de datos...', 'info');
      await window.API.crearRegistroTiempo({
        asignacion_id: Number(asignacionId),
        inicio: antes.toISOString().slice(0, 19).replace('T', ' '),
        fin: ahora.toISOString().slice(0, 19).replace('T', ' '),
        horas,
        tarifa_aplicada: Number(tarifaHora),
        origen: 'MANUAL'
      });
      const ganado = (horas * Number(tarifaHora)).toFixed(2);
      window.App.mostrarToast(`¡${horas}h registradas (+$${ganado} USD)!`, 'success');
      await window.State.recargarTodo();
    } catch (error) {
      window.App.mostrarToast(`Error al registrar horas: ${error.message}`, 'error');
    }
  },

  async cambiarEstadoProyecto(proyectoId, nuevoEstado) {
    try {
      window.App.mostrarToast(`Actualizando estado del proyecto #${proyectoId} a ${nuevoEstado}...`, 'info');
      await window.API.actualizarEstadoProyecto(proyectoId, nuevoEstado);
      window.App.mostrarToast(
        nuevoEstado === 'FINALIZADO'
          ? '¡Proyecto marcado como COMPLETADO!'
          : 'Proyecto marcado como EN CURSO (Faltante).',
        'success'
      );
      await window.State.recargarTodo();
    } catch (error) {
      // Actualizar localmente en memoria si no se tiene sesión activa
      const proy = (window.State.data.proyectos || []).find(p => Number(p.id) === Number(proyectoId));
      if (proy) {
        proy.estado = nuevoEstado;
        this.render();
        window.App.mostrarToast(`Estado del proyecto actualizado en vista a ${nuevoEstado}.`, 'success');
      } else {
        window.App.mostrarToast(`No se pudo cambiar el estado: ${error.message}`, 'error');
      }
    }
  },

  setFiltro(disp) {
    this.filtroDisponibilidad = disp;
    this.render();
  },

  limpiarFiltros() {
    this.filtroDisponibilidad = 'TODOS';
    this.busqueda = '';
    this.render();
  },

  verPerfil(usuarioId) {
    const trabajador = (window.State.data.trabajadores || []).find(t => Number(t.usuario_id) === Number(usuarioId));
    const usuario = (window.State.data.usuarios || []).find(u => Number(u.id) === Number(usuarioId));
    const usuarioActivo = window.State.data.usuarioActivo;
    const esCliente = usuarioActivo && usuarioActivo.rol === 'CLIENTE';

    if (!trabajador && !usuario) return;

    const modalBody = document.getElementById('genericModalContent');
    const modalTitle = document.getElementById('genericModalTitle');
    const m = this.calcularMetricasTrabajador(usuarioId);

    const nombre = (usuario && usuario.nombre) || (trabajador && trabajador.nombre) || 'Especialista';
    if (modalTitle) modalTitle.textContent = `Perfil Profesional: ${nombre}`;

    if (modalBody) {
      modalBody.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
            <div class="w-14 h-14 rounded-2xl bg-violet-700 text-white font-bold flex items-center justify-center text-xl font-mono shadow-md">
              ${window.App.escapeHTML(nombre.slice(0, 2).toUpperCase())}
            </div>
            <div>
              <h4 class="font-bold text-slate-900 dark:text-white text-lg leading-snug">${window.App.escapeHTML(nombre)}</h4>
              <p class="text-xs text-slate-500">${window.App.escapeHTML(usuario ? usuario.email : '')}</p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 text-xs font-mono">
            <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700">
              <span class="text-slate-400 font-sans block">Horas Totales</span>
              <span class="font-bold text-slate-900 dark:text-white text-base">${m.horasTotales.toFixed(2)} hrs</span>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700">
              <span class="text-slate-400 font-sans block">Dinero Ganado</span>
              <span class="font-bold text-emerald-700 dark:text-emerald-400 text-base">$${m.dineroTotalUSD.toFixed(2)}</span>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700">
              <span class="text-slate-400 font-sans block">Proyectos</span>
              <span class="font-bold text-indigo-700 dark:text-indigo-400 text-base">${m.proyectosCompletados.length}✓ / ${m.proyectosFaltantes.length}⏳</span>
            </div>
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button data-csp-click="window.App.cerrarModalGenerico()" class="btn-secondary text-xs">Cerrar</button>
            <button data-csp-click="window.App.cerrarModalGenerico(); TalentoView.seleccionarTrabajador(${usuarioId})" class="btn-primary text-xs">
              Abrir Dashboard Completo
            </button>
          </div>
        </div>
      `;
    }

    window.App.abrirModalGenerico();
  },

  asignarDirecto(usuarioId) {
    const trabajador = (window.State.data.trabajadores || []).find(t => Number(t.usuario_id) === Number(usuarioId));
    const usuario = (window.State.data.usuarios || []).find(u => Number(u.id) === Number(usuarioId));
    const nombre = (usuario && usuario.nombre) || (trabajador && trabajador.nombre) || 'Especialista';

    const proyectos = (window.State.data.proyectos || []).filter(p => p.estado === 'ABIERTO');

    if (proyectos.length === 0) {
      window.App.mostrarToast('No hay proyectos abiertos actualmente. Publica uno primero.', 'warning');
      window.App.abrirModalPublicarProyecto();
      return;
    }

    const modalBody = document.getElementById('genericModalContent');
    const modalTitle = document.getElementById('genericModalTitle');
    if (modalTitle) modalTitle.textContent = `Contratar a ${nombre}`;

    if (modalBody) {
      modalBody.innerHTML = `
        <form id="formAsignarDirecto" data-csp-submit="TalentoView.guardarAsignacionDirecta(event, ${usuarioId})" class="space-y-4">
          <p class="text-xs text-slate-600 dark:text-slate-300">
            Selecciona el proyecto en el cual deseas vincular a <strong>${window.App.escapeHTML(nombre)}</strong>.
          </p>

          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Proyecto Abierto</label>
            <select id="asigProyectoSelect" required class="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-violet-600">
              ${proyectos.map(p => `<option value="${p.id}">${window.App.escapeHTML(p.nombre_proyecto)} (${window.App.escapeHTML(p.tipo)})</option>`).join('')}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Rol en el Proyecto</label>
              <input id="asigRolInput" type="text" value="Especialista Principal" required class="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-violet-600"/>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tarifa por Hora (USD)</label>
              <input id="asigTarifaInput" type="number" step="0.5" min="5" value="75.00" required class="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-violet-600 font-mono"/>
            </div>
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" data-csp-click="window.App.cerrarModalGenerico()" class="btn-secondary text-xs">Cancelar</button>
            <button type="submit" class="btn-primary text-xs">Formalizar Asignación</button>
          </div>
        </form>
      `;
    }

    window.App.abrirModalGenerico();
  },

  async guardarAsignacionDirecta(event, trabajadorId) {
    event.preventDefault();
    const proyectoId = document.getElementById('asigProyectoSelect').value;
    const rol = document.getElementById('asigRolInput').value.trim();
    const tarifa = document.getElementById('asigTarifaInput').value;

    try {
      window.App.mostrarToast('Creando asignación en Express (:3000)...', 'info');
      await window.API.crearAsignacion({
        trabajador_id: Number(trabajadorId),
        proyecto_id: Number(proyectoId),
        rol_en_proyecto: rol,
        tarifa_por_hora: Number(tarifa)
      });

      window.App.cerrarModalGenerico();
      window.App.mostrarToast('¡Asignación formalizada con éxito!', 'success');
      await window.State.recargarTodo();
    } catch (error) {
      window.App.mostrarToast(`Error al contratar: ${error.message}`, 'error');
    }
  }
};

window.TalentoView = TalentoView;
