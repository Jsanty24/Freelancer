/**
 * Freelancer — Vista Workspace & Gestión de Tiempo
 * Con RBAC, Aprobación de Horas por Cliente/Admin, Temporizador de Servidor, Sanitización XSS y Modo Oscuro
 */

const WorkspaceView = {
  render() {
    const container = document.getElementById('viewWorkspace');
    if (!container) return;

    const asignaciones = window.State.data.asignaciones || [];
    const registrosTiempo = window.State.data.registrosTiempo || [];
    const proyectos = window.State.data.proyectos || [];
    const usuarios = window.State.data.usuarios || [];
    const trabajadores = window.State.data.trabajadores || [];
    const usuarioActivo = window.State.data.usuarioActivo;
    const esCliente = usuarioActivo && usuarioActivo.rol === 'CLIENTE';
    const esTrabajador = usuarioActivo && usuarioActivo.rol === 'TRABAJADOR';
    const esAdmin = usuarioActivo && usuarioActivo.rol === 'ADMIN';
    const puedeAprobar = esCliente || esAdmin;

    const registrosPendientes = registrosTiempo.filter(r => r.estado === 'PENDIENTE');
    const registrosAprobadosSinFactura = registrosTiempo.filter(r => r.estado === 'APROBADO' && !r.factura_id);

    // Calcular métricas totales
    let totalHoras = 0;
    let totalAcumuladoUSD = 0;

    registrosTiempo.forEach(r => {
      const asig = asignaciones.find(a => a.id === r.asignacion_id);
      const h = Number(r.horas) || 0;
      const tarifa = Number(r.tarifa_aplicada || (asig && asig.tarifa_por_hora) || 70.0);
      totalHoras += h;
      totalAcumuladoUSD += (h * tarifa);
    });

    container.innerHTML = `
      <!-- Header Workspace -->
      <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-violet-200 dark:border-violet-800">
            <span class="material-symbols-outlined text-[15px]">terminal</span> Entorno de Operaciones & Sprint
          </span>
          <h2 class="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Workspace de Operaciones</h2>
          <p class="text-slate-500 text-sm mt-1 max-w-2xl">
            Gestiona horas registradas con trazabilidad auditada, aprueba tiempos pendientes para facturación y supervisa asignaciones activas.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          ${esTrabajador ? `
            <button data-csp-click="WorkspaceView.abrirModalRegistroManual()" class="btn-primary text-xs">
              <span class="material-symbols-outlined text-[16px]">add_alarm</span> Registrar Horas Manuales
            </button>
            ${registrosAprobadosSinFactura.length > 0 ? `
              <button data-csp-click="window.App.cambiarVista('finanzas')" class="btn-secondary text-xs">
                <span class="material-symbols-outlined text-[16px]">receipt_long</span> Facturar Aprobadas (${registrosAprobadosSinFactura.length})
              </button>
            ` : ''}
          ` : ''}
          ${puedeAprobar ? `
            ${registrosPendientes.length > 0 ? `
              <button data-csp-click="WorkspaceView.aprobarTodosPendientes()" class="btn-primary text-xs">
                <span class="material-symbols-outlined text-[16px]">done_all</span> Aprobar Horas Pendientes (${registrosPendientes.length})
              </button>
            ` : `
              <span class="text-xs text-slate-500 font-mono">Modo ${esAdmin ? 'Admin' : 'Cliente'}: Supervisión y Aprobación de Horas</span>
            `}
          ` : ''}
        </div>
      </div>

      <!-- Tarjetas de Métricas -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div class="fl-card p-5 bg-gradient-to-br from-white to-violet-50/40 dark:from-slate-800 dark:to-violet-950/20">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Horas Auditadas</span>
            <span class="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 material-symbols-outlined text-[20px]">timer</span>
          </div>
          <div class="text-3xl font-bold text-slate-900 dark:text-white font-mono">${totalHoras.toFixed(2)} <span class="text-xs text-slate-500 font-sans font-normal">hrs</span></div>
          <span class="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">check_circle</span> ${registrosPendientes.length} pendientes • ${registrosTiempo.filter(r => r.estado === 'APROBADO').length} aprobadas
          </span>
        </div>

        <div class="fl-card p-5 bg-gradient-to-br from-white to-emerald-50/40 dark:from-slate-800 dark:to-emerald-950/20">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Monto Devengado</span>
            <span class="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 material-symbols-outlined text-[20px]">payments</span>
          </div>
          <div class="text-3xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">$${totalAcumuladoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span class="text-xs text-slate-500 font-sans font-normal">USD</span></div>
          <span class="text-xs text-slate-500 font-medium mt-1">Importe registrado; no representa fondos protegidos ni un pago</span>
        </div>

        <div class="fl-card p-5 bg-gradient-to-br from-white to-indigo-50/40 dark:from-slate-800 dark:to-indigo-950/20">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Asignaciones Activas</span>
            <span class="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 material-symbols-outlined text-[20px]">assignment</span>
          </div>
          <div class="text-3xl font-bold text-indigo-900 dark:text-indigo-300 font-mono">${asignaciones.length} <span class="text-xs text-slate-500 font-sans font-normal">proyectos</span></div>
          <span class="text-xs text-indigo-700 dark:text-indigo-400 font-medium mt-1 flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">bolt</span> Microservicio Express (:3000)
          </span>
        </div>
      </div>

      <!-- Asignaciones y Proyectos Vinculados -->
      <div class="mb-8">
        <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-violet-700">work</span> Asignaciones de Contrato Formalizadas
        </h3>

        ${asignaciones.length === 0 ? `
          <!-- Empty State Ilustrado -->
          <div class="p-8 bg-white dark:bg-slate-800/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
            <div class="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-2">
              <span class="material-symbols-outlined text-[32px]">assignment_add</span>
            </div>
            <h4 class="text-base font-bold text-slate-800 dark:text-white">Sin asignaciones activas</h4>
            <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Las asignaciones se generan al aceptar una postulación en Contratos o al contratar directamente a un talento calificado.
            </p>
            <div class="mt-3">
              <button data-csp-click="window.App.cambiarVista('contratos')" class="btn-primary text-xs">
                Ir a Contratos
              </button>
            </div>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${asignaciones.map(asig => {
              const proy = proyectos.find(p => p.id === asig.proyecto_id);
              const trab = usuarios.find(u => u.id === asig.trabajador_id) || trabajadores.find(t => (t.usuario_id || t.id) === asig.trabajador_id);
              const nombreProy = proy ? proy.nombre_proyecto : `Proyecto #${asig.proyecto_id}`;
              const nombreTrab = trab ? trab.nombre : `Especialista #${asig.trabajador_id}`;
              const timerActivo = Boolean(asig.temporizador_inicio);
              const esCompletado = proy && proy.estado === 'FINALIZADO';
              const regsAsig = registrosTiempo.filter(r => Number(r.asignacion_id) === Number(asig.id));
              let horasAsig = 0;
              let dineroAsig = 0;
              regsAsig.forEach(r => {
                const h = Number(r.horas) || 0;
                const t = Number(r.tarifa_aplicada || asig.tarifa_por_hora || 70);
                horasAsig += h;
                dineroAsig += (h * t);
              });

              return `
                <div class="fl-card p-4 flex flex-col justify-between">
                  <div>
                    <div class="flex items-start justify-between gap-2 mb-2">
                      <div class="flex items-center gap-1.5">
                        <span class="badge-tech font-mono text-[10px]">Asignación #${asig.id}</span>
                        <span class="${esCompletado ? 'badge-success' : 'badge-warning'} text-[10px]">
                          ${esCompletado ? 'Completado' : 'En Curso'}
                        </span>
                      </div>
                      <span class="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">$${Number(asig.tarifa_por_hora).toFixed(2)}/h</span>
                    </div>
                    <h4 class="font-bold text-slate-900 dark:text-white text-sm mb-1 leading-snug line-clamp-1">${window.App.escapeHTML(nombreProy)}</h4>
                    <p class="text-xs text-slate-500 mb-2">Rol: <strong class="text-slate-700 dark:text-slate-300">${window.App.escapeHTML(asig.rol_en_proyecto)}</strong></p>
                    <div class="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg flex items-center justify-between border border-slate-100 dark:border-slate-700 mb-2">
                      <span>Trabajador:</span>
                      <span class="font-medium text-slate-800 dark:text-white">${window.App.escapeHTML(nombreTrab)}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                      <div>
                        <span class="text-[10px] font-sans uppercase text-slate-400 block">Horas Llevadas</span>
                        <span class="font-bold text-slate-900 dark:text-white">${horasAsig.toFixed(2)} hrs</span>
                      </div>
                      <div>
                        <span class="text-[10px] font-sans uppercase text-slate-400 block">Dinero Ganado</span>
                        <span class="font-bold text-emerald-700 dark:text-emerald-400">$${dineroAsig.toFixed(2)} USD</span>
                      </div>
                    </div>
                  </div>
                  <div class="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <button data-csp-click="window.TalentoView.abrirDashboardProyecto(${Number(asig.proyecto_id)}, ${Number(asig.id)})" class="btn-primary text-xs py-1 px-2.5">
                      <span class="material-symbols-outlined text-[14px]">space_dashboard</span> Dashboard & Subir Info
                    </button>
                    ${esTrabajador ? `
                      ${timerActivo ? `
                        <button data-csp-click="WorkspaceView.detenerTemporizadorServidor(${Number(asig.id)})" class="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1">
                          <span class="material-symbols-outlined text-[14px]">stop_circle</span> Detener (${horasAsig.toFixed(1)}h)
                        </button>
                      ` : `
                        <button data-csp-click="WorkspaceView.iniciarTemporizadorServidor(${Number(asig.id)})" class="btn-secondary text-xs py-1 px-2.5">
                          <span class="material-symbols-outlined text-[14px]">play_circle</span> Temporizador
                        </button>
                      `}
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Tabla Historial de Horas Registradas -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span class="material-symbols-outlined text-violet-700">history_toggle_drop</span> Registros de Tiempo Auditados
          </h3>
          <span class="text-xs font-mono text-slate-500">${registrosTiempo.length} registros</span>
        </div>

        ${registrosTiempo.length === 0 ? `
          <div class="p-8 bg-white dark:bg-slate-800/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
            <p class="text-xs text-slate-500">No se han registrado sesiones de tiempo aún. Utiliza el Time Tracker superior o registra horas manuales.</p>
          </div>
        ` : `
          <div class="fl-card overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                  <tr>
                    <th class="py-3 px-4">ID</th>
                    <th class="py-3 px-4">Proyecto / Asignación</th>
                    <th class="py-3 px-4">Fecha</th>
                    <th class="py-3 px-4">Horas</th>
                    <th class="py-3 px-4">Tarifa</th>
                    <th class="py-3 px-4">Total USD</th>
                    <th class="py-3 px-4">Origen</th>
                    <th class="py-3 px-4">Estado</th>
                    <th class="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  ${registrosTiempo.map(reg => {
                    const asig = asignaciones.find(a => a.id === reg.asignacion_id);
                    const proy = asig ? proyectos.find(p => p.id === asig.proyecto_id) : null;
                    const nombreProy = proy ? proy.nombre_proyecto : `Asignación #${reg.asignacion_id}`;
                    const tarifaEfectiva = Number(reg.tarifa_aplicada || (asig && asig.tarifa_por_hora) || 70.0);
                    const total = (Number(reg.horas) * tarifaEfectiva).toFixed(2);
                    const fechaStr = reg.inicio ? new Date(reg.inicio).toLocaleDateString() : 'N/A';

                    let estadoBadge = 'badge-warning';
                    if (reg.estado === 'APROBADO') estadoBadge = 'badge-success';
                    if (reg.estado === 'CONGELADO') estadoBadge = 'badge-tech';

                    return `
                      <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td class="py-3 px-4 text-slate-400">#${reg.id}</td>
                        <td class="py-3 px-4 font-sans font-medium text-slate-900 dark:text-white max-w-[200px] truncate" title="${window.App.escapeHTML(nombreProy)}">
                          ${window.App.escapeHTML(nombreProy)}
                        </td>
                        <td class="py-3 px-4 text-slate-600 dark:text-slate-300">${fechaStr}</td>
                        <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${Number(reg.horas).toFixed(2)} h</td>
                        <td class="py-3 px-4 text-slate-600 dark:text-slate-300">$${tarifaEfectiva.toFixed(2)}/h</td>
                        <td class="py-3 px-4 font-bold text-emerald-700 dark:text-emerald-400">$${total}</td>
                        <td class="py-3 px-4 font-sans">
                          <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${
                            reg.origen === 'TEMPORIZADOR' ? 'bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }">
                            ${window.App.escapeHTML(reg.origen)}
                          </span>
                        </td>
                        <td class="py-3 px-4 font-sans">
                          <span class="${estadoBadge} text-[10px]">${window.App.escapeHTML(reg.estado)}</span>
                        </td>
                        <td class="py-3 px-4 text-right font-sans">
                          ${reg.estado === 'PENDIENTE' ? (
                            puedeAprobar ? `
                              <button data-csp-click="WorkspaceView.aprobarRegistro(${Number(reg.id)}, ${tarifaEfectiva})" class="btn-primary text-xs py-1 px-2.5">
                                <span class="material-symbols-outlined text-[14px]">check_circle</span> Aprobar horas
                              </button>
                            ` : `
                              <span class="text-[11px] text-amber-700 dark:text-amber-400 font-medium">⏳ En revisión del cliente</span>
                            `
                          ) : reg.estado === 'APROBADO' ? (
                            esTrabajador ? `
                              <button data-csp-click="window.App.cambiarVista('finanzas')" class="btn-secondary text-xs py-1 px-2.5">
                                <span class="material-symbols-outlined text-[14px]">receipt_long</span> Facturar
                              </button>
                            ` : `
                              <span class="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">✓ Aprobado para facturar</span>
                            `
                          ) : `
                            <span class="text-[11px] text-violet-700 dark:text-violet-400 font-semibold">
                              🔒 Factura #${reg.factura_id || 'Emitida'}
                            </span>
                          `}
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

  async aprobarRegistro(registroId, tarifaAplicada) {
    try {
      window.App.mostrarToast(`Aprobando registro de tiempo #${registroId}...`, 'info');
      await window.API.aprobarRegistroTiempo(registroId, tarifaAplicada);
      window.App.mostrarToast(`Registro #${registroId} aprobado correctamente. Ya puede ser facturado.`, 'success');
      await window.State.recargarTodo();
    } catch (error) {
      window.App.mostrarToast(`No se pudo aprobar el registro: ${error.message}`, 'error');
    }
  },

  async aprobarTodosPendientes() {
    const registrosTiempo = window.State.data.registrosTiempo || [];
    const asignaciones = window.State.data.asignaciones || [];
    const pendientes = registrosTiempo.filter(r => r.estado === 'PENDIENTE');
    if (pendientes.length === 0) {
      window.App.mostrarToast('No hay registros de tiempo pendientes por aprobar.', 'info');
      return;
    }

    try {
      window.App.mostrarToast(`Aprobando ${pendientes.length} registro(s) de tiempo...`, 'info');
      for (const reg of pendientes) {
        const asig = asignaciones.find(a => a.id === reg.asignacion_id);
        const tarifa = Number(reg.tarifa_aplicada || (asig && asig.tarifa_por_hora) || 70.0);
        await window.API.aprobarRegistroTiempo(reg.id, tarifa);
      }
      window.App.mostrarToast(`¡${pendientes.length} registro(s) aprobados correctamente!`, 'success');
      await window.State.recargarTodo();
    } catch (error) {
      window.App.mostrarToast(`Error al aprobar registros: ${error.message}`, 'error');
      await window.State.recargarTodo();
    }
  },

  async iniciarTemporizadorServidor(asignacionId) {
    try {
      window.App.mostrarToast(`Iniciando temporizador en asignación #${asignacionId}...`, 'info');
      await window.API.iniciarTemporizador(asignacionId);
      window.App.mostrarToast('Temporizador iniciado en la base de datos.', 'success');
      await window.State.recargarTodo();
    } catch (error) {
      window.App.mostrarToast(`No se pudo iniciar el temporizador: ${error.message}`, 'error');
    }
  },

  async detenerTemporizadorServidor(asignacionId) {
    try {
      window.App.mostrarToast(`Deteniendo temporizador en asignación #${asignacionId}...`, 'info');
      const res = await window.API.detenerTemporizador(asignacionId);
      const horas = res && res.horasRegistradas !== undefined ? ` (${res.horasRegistradas} h)` : '';
      window.App.mostrarToast(`Temporizador detenido y registro creado${horas}.`, 'success');
      await window.State.recargarTodo();
    } catch (error) {
      window.App.mostrarToast(`No se pudo detener el temporizador: ${error.message}`, 'error');
    }
  },

  abrirModalRegistroManual() {
    const usuarioActivo = window.State.data.usuarioActivo;
    if (usuarioActivo && usuarioActivo.rol === 'CLIENTE') {
      window.App.mostrarToast('El registro de horas es exclusivo de los freelancers asignados.', 'warning');
      return;
    }

    const asignaciones = window.State.data.asignaciones || [];
    const proyectos = window.State.data.proyectos || [];

    if (asignaciones.length === 0) {
      window.App.mostrarToast('No hay asignaciones para registrar tiempo. Formaliza una primero en Contratos.', 'warning');
      return;
    }

    const modalBody = document.getElementById('genericModalContent');
    const modalTitle = document.getElementById('genericModalTitle');

    if (modalTitle) modalTitle.textContent = 'Registrar Horas Manuales';
    if (modalBody) {
      modalBody.innerHTML = `
        <form id="formRegistroManual" data-csp-submit="WorkspaceView.guardarRegistroManual(event)" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Seleccionar Asignación / Proyecto</label>
            <select id="regManualAsigSelect" required class="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-violet-600">
              ${asignaciones.map(a => {
                const proy = proyectos.find(p => p.id === a.proyecto_id);
                const nombre = proy ? proy.nombre_proyecto : `Asignación #${a.id}`;
                return `<option value="${a.id}" data-tarifa="${a.tarifa_por_hora}">${window.App.escapeHTML(nombre)} ($${a.tarifa_por_hora}/h)</option>`;
              }).join('')}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Cantidad de Horas</label>
              <input id="regManualHorasInput" type="number" step="0.25" min="0.25" max="24" value="4.00" required class="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-violet-600 font-mono"/>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tarifa por Hora (USD)</label>
              <input id="regManualTarifaInput" type="number" step="0.5" value="${asignaciones[0].tarifa_por_hora || 70.0}" required class="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-violet-600 font-mono"/>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Descripción de las actividades realizadas</label>
            <textarea id="regManualDescInput" rows="2" placeholder="Ej. Refactorización de endpoints, diseño de tokens en Figma..." class="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-violet-600"></textarea>
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" data-csp-click="window.App.cerrarModalGenerico()" class="btn-secondary text-xs">Cancelar</button>
            <button type="submit" class="btn-primary text-xs">Registrar en MySQL</button>
          </div>
        </form>
      `;

      const select = document.getElementById('regManualAsigSelect');
      const tarifaInp = document.getElementById('regManualTarifaInput');
      if (select && tarifaInp) {
        select.addEventListener('change', () => {
          const selectedOpt = select.options[select.selectedIndex];
          if (selectedOpt && selectedOpt.dataset.tarifa) {
            tarifaInp.value = selectedOpt.dataset.tarifa;
          }
        });
      }
    }

    window.App.abrirModalGenerico();
  },

  async guardarRegistroManual(event) {
    event.preventDefault();
    const asigId = document.getElementById('regManualAsigSelect').value;
    const horas = document.getElementById('regManualHorasInput').value;
    const tarifa = document.getElementById('regManualTarifaInput').value;

    const ahora = new Date();
    const antes = new Date(ahora.getTime() - Number(horas) * 3600 * 1000);

    try {
      window.App.mostrarToast('Guardando registro de tiempo en Express...', 'info');
      await window.API.crearRegistroTiempo({
        asignacion_id: Number(asigId),
        inicio: antes.toISOString().slice(0, 19).replace('T', ' '),
        fin: ahora.toISOString().slice(0, 19).replace('T', ' '),
        horas: Number(horas),
        tarifa_aplicada: Number(tarifa),
        origen: 'MANUAL'
      });

      window.App.cerrarModalGenerico();
      window.App.mostrarToast(`¡${horas} horas registradas exitosamente en la base de datos!`, 'success');
      await window.State.recargarTodo();
    } catch (error) {
      window.App.mostrarToast(`Error: ${error.message}`, 'error');
    }
  }
};

window.WorkspaceView = WorkspaceView;
