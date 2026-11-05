/**
 * Freelancer — Vista Workspace & Gestión de Tiempo
 * Con RBAC, Sanitización XSS, Empty States y Modo Oscuro
 */

const WorkspaceView = {
  render() {
    const container = document.getElementById('viewWorkspace');
    if (!container) return;

    const asignaciones = window.State.data.asignaciones || [];
    const registrosTiempo = window.State.data.registrosTiempo || [];
    const proyectos = window.State.data.proyectos || [];
    const usuarios = window.State.data.usuarios || [];
    const usuarioActivo = window.State.data.usuarioActivo;
    const esCliente = usuarioActivo && usuarioActivo.rol === 'CLIENTE';

    // Calcular métricas totales
    let totalHoras = 0;
    let totalAcumuladoUSD = 0;

    registrosTiempo.forEach(r => {
      const h = Number(r.horas) || 0;
      const tarifa = Number(r.tarifa_aplicada) || 70.0;
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
            Gestiona horas registradas con trazabilidad auditada, revisa asignaciones activas de microservicios y prepara entregables.
          </p>
        </div>

        <div class="flex items-center gap-3">
          ${!esCliente ? `
            <button onclick="WorkspaceView.abrirModalRegistroManual()" class="btn-primary text-xs">
              <span class="material-symbols-outlined text-[16px]">add_alarm</span> Registrar Horas Manuales
            </button>
          ` : `
            <span class="text-xs text-slate-500 font-mono">Modo Cliente: Supervisión de Horas</span>
          `}
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
            <span class="material-symbols-outlined text-[14px]">check_circle</span> Sincronizado en MySQL
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
              <button onclick="window.App.cambiarVista('contratos')" class="btn-primary text-xs">
                Ir a Contratos
              </button>
            </div>
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${asignaciones.map(asig => {
              const proy = proyectos.find(p => p.id === asig.proyecto_id);
              const trab = usuarios.find(u => u.id === asig.trabajador_id);
              const nombreProy = proy ? proy.nombre_proyecto : `Proyecto #${asig.proyecto_id}`;
              const nombreTrab = trab ? trab.nombre : `Especialista #${asig.trabajador_id}`;

              return `
                <div class="fl-card p-4">
                  <div class="flex items-start justify-between gap-2 mb-2">
                    <span class="badge-tech font-mono text-[10px]">Asignación #${asig.id}</span>
                    <span class="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">$${Number(asig.tarifa_por_hora).toFixed(2)}/h</span>
                  </div>
                  <h4 class="font-bold text-slate-900 dark:text-white text-sm mb-1 leading-snug line-clamp-1">${window.App.escapeHTML(nombreProy)}</h4>
                  <p class="text-xs text-slate-500 mb-2">Rol: <strong class="text-slate-700 dark:text-slate-300">${window.App.escapeHTML(asig.rol_en_proyecto)}</strong></p>
                  <div class="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg flex items-center justify-between border border-slate-100 dark:border-slate-700">
                    <span>Trabajador:</span>
                    <span class="font-medium text-slate-800 dark:text-white">${window.App.escapeHTML(nombreTrab)}</span>
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
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  ${registrosTiempo.map(reg => {
                    const asig = asignaciones.find(a => a.id === reg.asignacion_id);
                    const proy = asig ? proyectos.find(p => p.id === asig.proyecto_id) : null;
                    const nombreProy = proy ? proy.nombre_proyecto : `Asignación #${reg.asignacion_id}`;
                    const total = (Number(reg.horas) * Number(reg.tarifa_aplicada || 70.0)).toFixed(2);
                    const fechaStr = reg.inicio ? new Date(reg.inicio).toLocaleDateString() : 'N/A';

                    return `
                      <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td class="py-3 px-4 text-slate-400">#${reg.id}</td>
                        <td class="py-3 px-4 font-sans font-medium text-slate-900 dark:text-white max-w-[200px] truncate" title="${window.App.escapeHTML(nombreProy)}">
                          ${window.App.escapeHTML(nombreProy)}
                        </td>
                        <td class="py-3 px-4 text-slate-600 dark:text-slate-300">${fechaStr}</td>
                        <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${Number(reg.horas).toFixed(2)} h</td>
                        <td class="py-3 px-4 text-slate-600 dark:text-slate-300">$${Number(reg.tarifa_aplicada || 70).toFixed(2)}/h</td>
                        <td class="py-3 px-4 font-bold text-emerald-700 dark:text-emerald-400">$${total}</td>
                        <td class="py-3 px-4 font-sans">
                          <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${
                            reg.origen === 'TEMPORIZADOR' ? 'bg-violet-100 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }">
                            ${reg.origen}
                          </span>
                        </td>
                        <td class="py-3 px-4 font-sans">
                          <span class="badge-success text-[10px]">${reg.estado}</span>
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
        <form id="formRegistroManual" onsubmit="WorkspaceView.guardarRegistroManual(event)" class="space-y-4">
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
            <button type="button" onclick="window.App.cerrarModalGenerico()" class="btn-secondary text-xs">Cancelar</button>
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