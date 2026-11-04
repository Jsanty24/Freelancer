/**
 * Freelancer — Vista Contratos, Hitos Escrow y Gestión de Postulaciones
 */

const ContratosView = {
  render() {
    const container = document.getElementById('viewContratos');
    if (!container) return;

    const postulaciones = window.State.data.postulaciones || [];
    const proyectos = window.State.data.proyectos || [];
    const usuarios = window.State.data.usuarios || [];
    const asignaciones = window.State.data.asignaciones || [];

    // Calcular métricas
    const pendientes = postulaciones.filter(p => p.estado === 'PENDIENTE').length;
    const aceptadas = postulaciones.filter(p => p.estado === 'ACEPTADA').length;

    container.innerHTML = `
      <!-- Header Contratos & Escrow -->
      <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold uppercase tracking-wider mb-2 border border-indigo-200">
            <span class="material-symbols-outlined text-[15px]">shield</span> Contratos Inteligentes & Escrow
          </span>
          <h2 class="text-3xl font-bold text-slate-900 tracking-tight">Gestión de Contratos & Propuestas</h2>
          <p class="text-slate-500 text-sm mt-1 max-w-2xl">
            Revisa las propuestas económicas recibidas para tus proyectos, evalúa términos y aprueba asignaciones con fondos retenidos en custodia hasta la entrega satisfactoria.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="window.State.recargarTodo()" class="btn-secondary text-xs">
            <span class="material-symbols-outlined text-[16px]">sync</span> Actualizar Datos
          </button>
        </div>
      </div>

      <!-- Resumen de Escrow & Contratos -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div class="fl-card p-5 bg-gradient-to-br from-white to-amber-50/40">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Postulaciones Pendientes</span>
            <span class="p-2 rounded-lg bg-amber-100 text-amber-700 material-symbols-outlined text-[20px]">pending_actions</span>
          </div>
          <div class="text-3xl font-bold text-amber-800 font-mono">${pendientes}</div>
          <span class="text-xs text-slate-500 font-medium mt-1">Requieren decisión del cliente</span>
        </div>

        <div class="fl-card p-5 bg-gradient-to-br from-white to-emerald-50/40">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Contratos Formalizados</span>
            <span class="p-2 rounded-lg bg-emerald-100 text-emerald-700 material-symbols-outlined text-[20px]">verified</span>
          </div>
          <div class="text-3xl font-bold text-emerald-800 font-mono">${aceptadas}</div>
          <span class="text-xs text-emerald-700 font-medium mt-1">Asignados en Express & MySQL</span>
        </div>

        <div class="fl-card p-5 bg-gradient-to-br from-white to-violet-50/40">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Protección de Fondos</span>
            <span class="p-2 rounded-lg bg-violet-100 text-violet-700 material-symbols-outlined text-[20px]">lock</span>
          </div>
          <div class="text-3xl font-bold text-violet-900 font-mono">100%</div>
          <span class="text-xs text-slate-500 font-medium mt-1">Garantía Escrow Multi-Hito</span>
        </div>
      </div>

      <!-- Lista de Postulaciones y Propuestas -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="material-symbols-outlined text-violet-700">fact_check</span> Todas las Propuestas Recibidas en la BD
          </h3>
          <span class="text-xs font-mono text-slate-500">${postulaciones.length} propuestas registradas</span>
        </div>

        ${postulaciones.length === 0 ? `
          <div class="p-8 bg-white rounded-2xl border border-dashed border-slate-300 text-center">
            <p class="text-xs text-slate-500">No hay postulaciones registradas en el sistema.</p>
          </div>
        ` : `
          <div class="space-y-4">
            ${postulaciones.map(post => {
              const proy = proyectos.find(p => p.id === post.proyecto_id);
              const trab = usuarios.find(u => u.id === post.trabajador_id);
              const nombreProy = proy ? proy.nombre_proyecto : `Proyecto #${post.proyecto_id}`;
              const nombreTrab = trab ? trab.nombre : `Especialista #${post.trabajador_id}`;
              const fechaStr = post.fecha_postulacion ? new Date(post.fecha_postulacion).toLocaleString() : 'Reciente';

              let badgeClase = 'badge-warning';
              if (post.estado === 'ACEPTADA') badgeClase = 'badge-success';
              if (post.estado === 'RECHAZADA') badgeClase = 'bg-rose-100 text-rose-800 border border-rose-200 rounded-full px-2 py-0.5 text-xs font-semibold';

              return `
                <div class="fl-card p-5">
                  <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div class="flex-1">
                      <div class="flex flex-wrap items-center gap-2 mb-2">
                        <span class="${badgeClase} uppercase text-[10px] tracking-wider">${post.estado}</span>
                        <span class="text-xs font-mono text-slate-400">Propuesta #${post.id}</span>
                        <span class="text-xs text-slate-400">• ${fechaStr}</span>
                      </div>

                      <h4 class="text-base font-bold text-slate-900 mb-1 leading-snug">
                        ${nombreProy}
                      </h4>

                      <div class="flex items-center gap-2 text-xs text-slate-600 mb-3">
                        <span class="material-symbols-outlined text-[16px] text-violet-700">person</span>
                        Postulante: <strong class="text-slate-900">${nombreTrab}</strong>
                      </div>

                      <div class="bg-slate-50 rounded-xl p-3 text-xs text-slate-700 leading-relaxed border border-slate-100">
                        <span class="text-slate-400 font-bold block mb-1 uppercase tracking-wider text-[10px]">Términos de la propuesta:</span>
                        "${post.mensaje || 'Sin carta de presentación adicional.'}"
                      </div>
                    </div>

                    <!-- Lado derecho: Tarifa y Acciones -->
                    <div class="md:w-56 flex flex-col justify-between items-start md:items-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <div class="text-left md:text-right">
                        <span class="text-[10px] uppercase font-bold text-slate-400 block">Tarifa Propuesta</span>
                        <span class="text-2xl font-bold font-mono text-violet-800">$${post.tarifa_propuesta} <span class="text-xs font-sans text-slate-500 font-normal">/hr</span></span>
                      </div>

                      ${post.estado === 'PENDIENTE' ? `
                        <div class="flex items-center gap-2 w-full md:w-auto">
                          <button onclick="ContratosView.responder(${post.id}, 'RECHAZADA')" class="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-all">
                            Rechazar
                          </button>
                          <button onclick="ContratosView.responder(${post.id}, 'ACEPTADA')" class="btn-primary text-xs py-1.5 px-3">
                            <span class="material-symbols-outlined text-[15px]">check</span> Aceptar Propuesta
                          </button>
                        </div>
                      ` : `
                        <div class="text-xs font-medium text-slate-500">
                          ${post.estado === 'ACEPTADA' ? '✓ Asignación vinculada en Express' : '✗ Propuesta desestimada'}
                        </div>
                      `}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  },

  async responder(postulacionId, nuevoEstado) {
    const accion = nuevoEstado === 'ACEPTADA' ? 'aceptar' : 'rechazar';
    if (!confirm(`¿Estás seguro de que deseas ${accion} esta postulación?`)) {
      return;
    }

    try {
      window.App.mostrarToast(`Procesando postulación #${postulacionId}...`, 'info');
      await window.API.responderPostulacion(postulacionId, nuevoEstado, 'Especialista Senior');
      
      window.App.mostrarToast(
        nuevoEstado === 'ACEPTADA' 
          ? '¡Postulación aceptada y contrato asignado en Express con éxito!' 
          : 'Postulación rechazada.', 
        'success'
      );
      
      await window.State.recargarTodo();
    } catch (error) {
      window.App.mostrarToast(`Error: ${error.message}`, 'error');
    }
  }
};

window.ContratosView = ContratosView;
