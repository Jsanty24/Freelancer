/**
 * Freelancer — Vista Panel de Control & Administración (Admin View)
 * Auditoría Global de Microservicios, Gestión de Usuarios, Supervisión de Proyectos y Escrow Ledger
 */

const AdminView = {
  filtroUsuarioRol: 'TODOS',
  filtroProyectoEstado: 'TODOS',
  estadoSaludServicios: null,
  cargandoSalud: false,

  async verificarSalud() {
    this.cargandoSalud = true;
    try {
      const res = await window.API.getHealth();
      this.estadoSaludServicios = res;
      window.App.mostrarToast('Salud de microservicios actualizada en vivo', 'success');
    } catch (err) {
      this.estadoSaludServicios = err.data || {
        status: 'degraded',
        error: err.message,
        services: { php_usuarios: 'offline', python_proyectos: 'offline', express_tiempo_facturas: 'offline' }
      };
      window.App.mostrarToast('Alerta: Uno o más microservicios no responden', 'warning');
    } finally {
      this.cargandoSalud = false;
      this.render();
    }
  },

  render() {
    const container = document.getElementById('viewAdmin');
    if (!container) return;

    if (!window.App.esAdministradorAutenticado()) {
      container.innerHTML = '<div class="fl-card p-6 text-sm text-slate-600 dark:text-slate-300">Inicia sesión como administrador para consultar este panel.</div>';
      return;
    }

    if (!this.estadoSaludServicios && !this.cargandoSalud) {
      this.verificarSalud();
    }

    const usuarios = window.State.data.usuarios || [];
    const proyectos = window.State.data.proyectos || [];
    const facturas = window.State.data.facturas || [];
    const asignaciones = window.State.data.asignaciones || [];
    const registrosTiempo = window.State.data.registrosTiempo || [];
    const postulaciones = window.State.data.postulaciones || [];

    // Calcular estadísticas globales
    const totalClientes = usuarios.filter(u => u.rol === 'CLIENTE').length;
    const totalTrabajadores = usuarios.filter(u => u.rol === 'TRABAJADOR').length;

    let volumenPendiente = 0;
    let volumenPagado = 0;
    facturas.forEach(f => {
      const val = Number(f.valor_total) || 0;
      if (f.estado_factura === 'PAGADA') {
        volumenPagado += val;
      } else if (f.estado_factura === 'PENDIENTE' || f.estado_factura === 'APROBADA') {
        volumenPendiente += val;
      }
    });

    const totalHoras = registrosTiempo.reduce((acc, r) => acc + (Number(r.horas) || 0), 0);

    // Filtrar usuarios
    const usuariosFiltrados = usuarios.filter(u => {
      if (this.filtroUsuarioRol === 'TODOS') return true;
      return u.rol === this.filtroUsuarioRol;
    });

    // Filtrar proyectos
    const proyectosFiltrados = proyectos.filter(p => {
      if (this.filtroProyectoEstado === 'TODOS') return true;
      return p.estado === this.filtroProyectoEstado;
    });

    const salud = this.estadoSaludServicios || {
      status: 'unknown',
      services: { php_usuarios: 'checking', python_proyectos: 'checking', express_tiempo_facturas: 'checking' }
    };
    const indicadorServicio = servicio => {
      const estado = salud.services && salud.services[servicio];
      if (estado === 'ok') {
        return {
          borde: 'border-l-emerald-500',
          icono: 'text-emerald-500',
          texto: 'text-emerald-600',
          simbolo: 'check_circle'
        };
      }
      if (estado === 'checking') {
        return {
          borde: 'border-l-slate-400',
          icono: 'text-slate-400',
          texto: 'text-slate-500',
          simbolo: 'progress_activity'
        };
      }
      return {
        borde: 'border-l-rose-500',
        icono: 'text-rose-500',
        texto: 'text-rose-600',
        simbolo: 'error'
      };
    };
    const textoEstadoServicio = servicio => {
      const estado = salud.services && salud.services[servicio];
      if (estado === 'ok') return 'ONLINE (200 OK)';
      if (estado === 'checking' || !estado) return 'VERIFICANDO...';
      return String(estado).toUpperCase();
    };
    const saludPhp = indicadorServicio('php_usuarios');
    const saludPython = indicadorServicio('python_proyectos');
    const saludExpress = indicadorServicio('express_tiempo_facturas');

    container.innerHTML = `
      <!-- Cabecera de Administración -->
      <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-xs font-bold uppercase tracking-wider border border-rose-200 dark:border-rose-800">
              <span class="material-symbols-outlined text-[15px]">security</span> Consola de administración
            </span>
          </div>
          <h2 class="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Panel de Administración de la Plataforma</h2>
          <p class="text-slate-500 text-sm mt-1 max-w-2xl">
            Supervisa los servicios, consulta perfiles registrados y modera el estado de los proyectos.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <button data-csp-click="AdminView.verificarSalud()" class="btn-secondary text-xs">
            <span class="material-symbols-outlined text-[16px] ${this.cargandoSalud ? 'animate-spin' : ''}">refresh</span>
            ${this.cargandoSalud ? 'Verificando...' : 'Diagnóstico de Servicios (:4000)'}
          </button>
          <button data-csp-click="AdminView.exportarAuditoria()" class="btn-primary text-xs">
            <span class="material-symbols-outlined text-[16px]">file_download</span> Exportar Auditoría JSON
          </button>
        </div>
      </div>

      <!-- Tarjetas de Diagnóstico de Microservicios -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <!-- Servicio 1: PHP Usuarios -->
        <div class="fl-card p-4 border-l-4 ${saludPhp.borde}">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold text-slate-500 uppercase">API 1: Usuarios (PHP)</span>
            <span class="material-symbols-outlined text-[18px] ${saludPhp.icono}">${saludPhp.simbolo}</span>
          </div>
          <div class="text-sm font-bold text-slate-900 dark:text-white font-mono">127.0.0.1:8000</div>
          <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
            <span>Perfiles & Auth</span>
            <span class="font-bold font-mono ${saludPhp.texto}">
              ${textoEstadoServicio('php_usuarios')}
            </span>
          </div>
        </div>

        <!-- Servicio 2: Python FastAPI Proyectos -->
        <div class="fl-card p-4 border-l-4 ${saludPython.borde}">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold text-slate-500 uppercase">API 2: Proyectos (FastAPI)</span>
            <span class="material-symbols-outlined text-[18px] ${saludPython.icono}">${saludPython.simbolo}</span>
          </div>
          <div class="text-sm font-bold text-slate-900 dark:text-white font-mono">127.0.0.1:5000</div>
          <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
            <span>CRUD & Postulaciones</span>
            <span class="font-bold font-mono ${saludPython.texto}">
              ${textoEstadoServicio('python_proyectos')}
            </span>
          </div>
        </div>

        <!-- Servicio 3: Express Horas & Facturas -->
        <div class="fl-card p-4 border-l-4 ${saludExpress.borde}">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold text-slate-500 uppercase">API 3: Ledger (Express)</span>
            <span class="material-symbols-outlined text-[18px] ${saludExpress.icono}">${saludExpress.simbolo}</span>
          </div>
          <div class="text-sm font-bold text-slate-900 dark:text-white font-mono">127.0.0.1:3000</div>
          <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
            <span>Tiempo & Facturas</span>
            <span class="font-bold font-mono ${saludExpress.texto}">
              ${textoEstadoServicio('express_tiempo_facturas')}
            </span>
          </div>
        </div>

        <!-- Servicio 4: API Gateway -->
        <div class="fl-card p-4 border-l-4 border-l-violet-600">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold text-slate-500 uppercase">API 4: Gateway Central</span>
            <span class="material-symbols-outlined text-[18px] text-violet-600">hub</span>
          </div>
          <div class="text-sm font-bold text-slate-900 dark:text-white font-mono">localhost:4000</div>
          <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
            <span>JWT & Proxy Orquestador</span>
            <span class="font-bold font-mono text-violet-600">OPERACIONAL</span>
          </div>
        </div>
      </div>

      <!-- Métricas Globales del Negocio -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div class="fl-card p-5 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900/40">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Población Total</span>
          <div class="text-3xl font-bold font-mono text-slate-900 dark:text-white">${usuarios.length}</div>
          <div class="text-xs text-slate-500 mt-1">${totalClientes} Clientes • ${totalTrabajadores} Freelancers</div>
        </div>

        <div class="fl-card p-5 bg-gradient-to-br from-white to-amber-50/50 dark:from-slate-800 dark:to-amber-950/20">
          <span class="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block mb-1">Facturas pendientes</span>
          <div class="text-3xl font-bold font-mono text-amber-800 dark:text-amber-300">$${volumenPendiente.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div class="text-xs text-slate-500 mt-1">Importes registrados; no depositados en custodia</div>
        </div>

        <div class="fl-card p-5 bg-gradient-to-br from-white to-emerald-50/50 dark:from-slate-800 dark:to-emerald-950/20">
          <span class="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">Volumen Liquidado</span>
          <div class="text-3xl font-bold font-mono text-emerald-700 dark:text-emerald-300">$${volumenPagado.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div class="text-xs text-slate-500 mt-1">Estado de factura; pago no verificado</div>
        </div>

        <div class="fl-card p-5 bg-gradient-to-br from-white to-indigo-50/50 dark:from-slate-800 dark:to-indigo-950/20">
          <span class="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider block mb-1">Horas Auditadas</span>
          <div class="text-3xl font-bold font-mono text-indigo-800 dark:text-indigo-300">${totalHoras.toFixed(1)} h</div>
          <div class="text-xs text-slate-500 mt-1">${registrosTiempo.length} registros de sprint</div>
        </div>
      </div>

      <!-- SECCIÓN 1: GESTIÓN AUDITADA DE USUARIOS (MySQL) -->
      <div class="mb-10">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-violet-700">badge</span> Directorio de Usuarios de MySQL
            </h3>
            <p class="text-xs text-slate-500">Consulta los perfiles y roles registrados.</p>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400">Filtrar rol:</span>
            <select
              data-csp-change="AdminView.setFiltroRol(this.value)"
              class="text-xs py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium">
              <option value="TODOS" ${this.filtroUsuarioRol === 'TODOS' ? 'selected' : ''}>Todos (${usuarios.length})</option>
              <option value="CLIENTE" ${this.filtroUsuarioRol === 'CLIENTE' ? 'selected' : ''}>Clientes (${totalClientes})</option>
              <option value="TRABAJADOR" ${this.filtroUsuarioRol === 'TRABAJADOR' ? 'selected' : ''}>Trabajadores (${totalTrabajadores})</option>
            </select>
          </div>
        </div>

        <div class="fl-card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                <tr>
                  <th class="py-3 px-4">ID</th>
                  <th class="py-3 px-4">Nombre Completo</th>
                  <th class="py-3 px-4">Correo Electrónico</th>
                  <th class="py-3 px-4">Teléfono</th>
                  <th class="py-3 px-4">Rol Asignado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                ${usuariosFiltrados.map(u => `
                  <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="py-3 px-4 text-slate-400">#${u.id}</td>
                    <td class="py-3 px-4 font-sans font-medium text-slate-900 dark:text-white">
                      ${window.App.escapeHTML(u.nombre)}
                    </td>
                    <td class="py-3 px-4 font-sans text-slate-600 dark:text-slate-300">
                      ${window.App.escapeHTML(u.email)}
                    </td>
                    <td class="py-3 px-4 text-slate-500">
                      ${window.App.escapeHTML(u.telefono || 'Sin registrar')}
                    </td>
                    <td class="py-3 px-4 font-sans">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${u.rol === 'CLIENTE' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'}">
                        ${u.rol}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- SECCIÓN 2: CONTROL & AUDITORÍA DE PROYECTOS (FastAPI) -->
      <div class="mb-10">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-violet-700">rule_folder</span> Moderación de Proyectos en Base de Datos
            </h3>
            <p class="text-xs text-slate-500">Modifica estados o cancela proyectos ante disputas o infracciones.</p>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400">Filtrar estado:</span>
            <select
              data-csp-change="AdminView.setFiltroEstado(this.value)"
              class="text-xs py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium">
              <option value="TODOS" ${this.filtroProyectoEstado === 'TODOS' ? 'selected' : ''}>Todos (${proyectos.length})</option>
              <option value="ABIERTO" ${this.filtroProyectoEstado === 'ABIERTO' ? 'selected' : ''}>Abiertos</option>
              <option value="EN_CURSO" ${this.filtroProyectoEstado === 'EN_CURSO' ? 'selected' : ''}>En Curso</option>
              <option value="FINALIZADO" ${this.filtroProyectoEstado === 'FINALIZADO' ? 'selected' : ''}>Finalizados</option>
              <option value="CANCELADO" ${this.filtroProyectoEstado === 'CANCELADO' ? 'selected' : ''}>Cancelados</option>
            </select>
          </div>
        </div>

        <div class="fl-card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                <tr>
                  <th class="py-3 px-4">ID</th>
                  <th class="py-3 px-4">Proyecto</th>
                  <th class="py-3 px-4">Categoría</th>
                  <th class="py-3 px-4">Cliente Propietario</th>
                  <th class="py-3 px-4">Estado Actual</th>
                  <th class="py-3 px-4 text-right">Intervención Admin</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                ${proyectosFiltrados.map(p => {
                  const cli = usuarios.find(u => u.id === p.cliente_id);
                  const nombreCli = cli ? cli.nombre : `Cliente #${p.cliente_id}`;

                  return `
                    <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td class="py-3 px-4 text-slate-400">#${p.id}</td>
                      <td class="py-3 px-4 font-sans font-medium text-slate-900 dark:text-white max-w-[220px] truncate" title="${window.App.escapeHTML(p.nombre_proyecto)}">
                        ${window.App.escapeHTML(p.nombre_proyecto)}
                      </td>
                      <td class="py-3 px-4">
                        <span class="badge-tech text-[10px]">${p.tipo}</span>
                      </td>
                      <td class="py-3 px-4 font-sans text-slate-600 dark:text-slate-300">
                        ${window.App.escapeHTML(nombreCli)}
                      </td>
                      <td class="py-3 px-4 font-sans">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.estado === 'ABIERTO' ? 'badge-success' : (p.estado === 'CANCELADO' ? 'bg-rose-100 text-rose-700' : 'badge-warning')
                        }">
                          ${p.estado}
                        </span>
                      </td>
                      <td class="py-3 px-4 text-right font-sans">
                        <div class="inline-flex items-center gap-1.5">
                          <button data-csp-click="AdminView.cambiarEstadoProyectoPrompt(${p.id}, '${p.estado}')" class="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition-colors">
                            Modificar Estado
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  setFiltroRol(rol) {
    this.filtroUsuarioRol = rol;
    this.render();
  },

  setFiltroEstado(estado) {
    this.filtroProyectoEstado = estado;
    this.render();
  },

  cambiarEstadoProyectoPrompt(proyectoId, estadoActual) {
    const estados = ['ABIERTO', 'EN_CURSO', 'PAUSADO', 'FINALIZADO', 'CANCELADO'];

    const modalBody = document.getElementById('genericModalContent');
    const modalTitle = document.getElementById('genericModalTitle');

    if (modalTitle) modalTitle.textContent = `Modificar Estado del Proyecto #${proyectoId}`;
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="space-y-4">
          <p class="text-xs text-slate-600 dark:text-slate-300">
            Como Administrador puedes alterar el ciclo de vida de este proyecto en el microservicio Python FastAPI:
          </p>
          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Nuevo Estado</label>
            <select id="adminNuevoEstadoSelect" class="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-violet-700 dark:text-violet-400">
              ${estados.map(est => `
                <option value="${est}" ${est === estadoActual ? 'selected' : ''}>${est} ${est === estadoActual ? '(Actual)' : ''}</option>
              `).join('')}
            </select>
          </div>
          <div class="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button data-csp-click="window.App.cerrarModalGenerico()" class="btn-secondary text-xs">Cancelar</button>
            <button data-csp-click="AdminView.aplicarCambioEstado(${proyectoId})" class="btn-primary text-xs">Guardar Cambio en BD</button>
          </div>
        </div>
      `;
    }

    window.App.abrirModalGenerico();
  },

  async aplicarCambioEstado(proyectoId) {
    if (!window.App.esAdministradorAutenticado()) {
      window.App.mostrarToast('Necesitas una sesión de administrador para modificar proyectos.', 'error');
      return;
    }

    const select = document.getElementById('adminNuevoEstadoSelect');
    if (!select) return;
    const nuevoEstado = select.value;

    try {
      window.App.mostrarToast(`Actualizando estado en FastAPI...`, 'info');
      await window.API.actualizarEstadoProyecto(proyectoId, nuevoEstado);
      window.App.cerrarModalGenerico();
      window.App.mostrarToast(`Proyecto #${proyectoId} actualizado a ${nuevoEstado}`, 'success');
      await window.State.recargarTodo();
      this.render();
    } catch (err) {
      window.App.mostrarToast(`Error al modificar proyecto: ${err.message}`, 'error');
    }
  },

  exportarAuditoria() {
    if (!window.App.esAdministradorAutenticado()) {
      window.App.mostrarToast('Necesitas una sesión de administrador para exportar auditorías.', 'error');
      return;
    }

    const dump = {
      timestamp: new Date().toISOString(),
      version: '1.0.0-PROD',
      gateway: 'localhost:4000',
      datos: {
        usuarios: window.State.data.usuarios || [],
        proyectos: window.State.data.proyectos || [],
        postulaciones: window.State.data.postulaciones || [],
        asignaciones: window.State.data.asignaciones || [],
        facturas: window.State.data.facturas || [],
        registrosTiempo: window.State.data.registrosTiempo || []
      }
    };

    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_freelancer_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    window.App.mostrarToast('Archivo de auditoría descargado correctamente', 'success');
  }
};

window.AdminView = AdminView;