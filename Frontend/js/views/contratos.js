/**
 * Freelancer — Gestión de propuestas y asignaciones
 * Con Control de Acceso (RBAC), Diálogos Estilizados No Bloqueantes y Sanitización XSS
 */

const ContratosView = {
  render() {
    const container = document.getElementById('viewContratos');
    if (!container) return;

    const postulaciones = window.State.data.postulaciones || [];
    const proyectos = window.State.data.proyectos || [];
    const usuarios = window.State.data.usuarios || [];
    const usuarioActivo = window.State.data.usuarioActivo;
    const esCliente = usuarioActivo && usuarioActivo.rol === 'CLIENTE';

    // Métricas
    const pendientes = postulaciones.filter(p => p.estado === 'PENDIENTE').length;
    const aceptadas = postulaciones.filter(p => p.estado === 'ACEPTADA').length;

    container.innerHTML = `
      <!-- Header Contratos -->
      <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-indigo-200 dark:border-indigo-800">
            <span class="material-symbols-outlined text-[15px]">description</span> Propuestas y contratos
          </span>
          <h2 class="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Gestión de Contratos & Propuestas</h2>
          <p class="text-slate-500 text-sm mt-1 max-w-2xl">
            Revisa propuestas y formaliza asignaciones. Los pagos y la custodia de fondos no están integrados.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="window.State.recargarTodo()" class="btn-secondary text-xs">
            <span class="material-symbols-outlined text-[16px]">sync</span> Sincronizar Microservicios
          </button>
        </div>
      </div>

      <div class="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        Aceptar una propuesta crea una asignación de trabajo; no deposita fondos ni activa un servicio de custodia.
      </div>

      <!-- Resumen de contratos -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div class="fl-card p-5 bg-gradient-to-br from-white to-amber-50/40 dark:from-slate-800 dark:to-amber-950/20">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Propuestas Pendientes</span>
            <span class="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 material-symbols-outlined text-[20px]">pending_actions</span>
          </div>
          <div class="text-3xl font-bold text-amber-800 dark:text-amber-400 font-mono">${pendientes}</div>
          <span class="text-xs text-slate-500 font-medium mt-1">En evaluación o negociación</span>
        </div>

        <div class="fl-card p-5 bg-gradient-to-br from-white to-emerald-50/40 dark:from-slate-800 dark:to-emerald-950/20">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Contratos Formalizados</span>
            <span class="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 material-symbols-outlined text-[20px]">verified</span>
          </div>
          <div class="text-3xl font-bold text-emerald-800 dark:text-emerald-400 font-mono">${aceptadas}</div>
          <span class="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-1">Asignados en Express & MySQL</span>
        </div>

        <div class="fl-card p-5 bg-gradient-to-br from-white to-violet-50/40 dark:from-slate-800 dark:to-violet-950/20">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Custodia de fondos</span>
            <span class="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 material-symbols-outlined text-[20px]">lock</span>
          </div>
          <div class="text-2xl font-bold text-violet-900 dark:text-violet-300">No disponible</div>
          <span class="text-xs text-slate-500 font-medium mt-1">No hay proveedor de custodia conectado</span>
        </div>
      </div>

      <!-- Lista de Postulaciones y Propuestas -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span class="material-symbols-outlined text-violet-700">fact_check</span> Propuestas Recibidas en la Plataforma
          </h3>
          <span class="text-xs font-mono text-slate-500">${postulaciones.length} propuestas registradas</span>
        </div>

        ${postulaciones.length === 0 ? `
          <!-- Empty State Ilustrado -->
          <div class="p-12 bg-white dark:bg-slate-800/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center">
            <div class="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-3">
              <span class="material-symbols-outlined text-[36px]">assignment_late</span>
            </div>
            <h4 class="text-base font-bold text-slate-800 dark:text-white">Aún no hay propuestas registradas</h4>
            <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Las propuestas económicas enviadas por los freelancers para los proyectos abiertos aparecerán aquí.
            </p>
            <div class="mt-4">
              <button onclick="window.App.cambiarVista('marketplace')" class="btn-primary text-xs">
                <span class="material-symbols-outlined text-[16px]">storefront</span> Explorar Marketplace
              </button>
            </div>
          </div>
        ` : `
          <div class="space-y-4">
            ${postulaciones.map(post => {
              const proy = proyectos.find(p => p.id === post.proyecto_id);
              const trab = usuarios.find(u => u.id === post.trabajador_id);
              const nombreProy = proy ? proy.nombre_proyecto : `Proyecto #${post.proyecto_id}`;
              const nombreTrab = trab ? trab.nombre : `Especialista #${post.trabajador_id}`;
              const fechaStr = post.fecha_postulacion ? new Date(post.fecha_postulacion).toLocaleString() : 'Reciente';

              // Contar mensajes del chat interno
              const mensajesChat = window.App.obtenerMensajesChat(post.id);
              const cantidadMensajes = mensajesChat.length;

              let badgeClase = 'badge-warning';
              if (post.estado === 'ACEPTADA') badgeClase = 'badge-success';
              if (post.estado === 'RECHAZADA') badgeClase = 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-full px-2 py-0.5 text-xs font-semibold';

              return `
                <div class="fl-card p-5">
                  <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div class="flex-1">
                      <div class="flex flex-wrap items-center gap-2 mb-2">
                        <span class="${badgeClase} uppercase text-[10px] tracking-wider">${window.App.escapeHTML(post.estado)}</span>
                        <span class="text-xs font-mono text-slate-400">Propuesta #${post.id}</span>
                        <span class="text-xs text-slate-400">• ${fechaStr}</span>
                      </div>

                      <h4 class="text-base font-bold text-slate-900 dark:text-white mb-1 leading-snug">
                        ${window.App.escapeHTML(nombreProy)}
                      </h4>

                      <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 mb-3">
                        <span class="material-symbols-outlined text-[16px] text-violet-700">person</span>
                        Postulante: <strong class="text-slate-900 dark:text-white">${window.App.escapeHTML(nombreTrab)}</strong>
                      </div>

                      <div class="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-100 dark:border-slate-700 mb-3">
                        <span class="text-slate-400 font-bold block mb-1 uppercase tracking-wider text-[10px]">Términos iniciales:</span>
                        "${window.App.escapeHTML(post.mensaje || 'Sin carta de presentación adicional.')}"
                      </div>

                      <!-- Botón de Chat de Negociación Directa -->
                      <button 
                        onclick="window.App.abrirModalChat(${post.id})" 
                        class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-xs font-semibold hover:bg-violet-100 transition-colors">
                        <span class="material-symbols-outlined text-[16px]">forum</span>
                        Chat de Negociación ${cantidadMensajes > 0 ? `<span class="px-1.5 py-0.2 rounded-full bg-violet-600 text-white text-[10px] font-mono">${cantidadMensajes}</span>` : ''}
                      </button>
                    </div>

                    <!-- Lado derecho: Tarifa y Acciones RBAC -->
                    <div class="md:w-56 flex flex-col justify-between items-start md:items-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      <div class="text-left md:text-right">
                        <span class="text-[10px] uppercase font-bold text-slate-400 block">Tarifa Propuesta</span>
                        <span class="text-2xl font-bold font-mono text-violet-800 dark:text-violet-400">$${Number(post.tarifa_propuesta).toFixed(2)} <span class="text-xs font-sans text-slate-500 font-normal">/hr</span></span>
                      </div>

                      ${post.estado === 'PENDIENTE' ? `
                        ${esCliente ? `
                          <!-- Acciones solo para CLIENTE -->
                          <div class="flex items-center gap-2 w-full md:w-auto">
                            <button onclick="ContratosView.responder(${post.id}, 'RECHAZADA')" class="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-all">
                              Rechazar
                            </button>
                            <button onclick="ContratosView.responder(${post.id}, 'ACEPTADA')" class="btn-primary text-xs py-1.5 px-3">
                              <span class="material-symbols-outlined text-[15px]">check</span> Formalizar Contrato
                            </button>
                          </div>
                        ` : `
                          <div class="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/50 font-medium">
                            ⏳ En revisión por el cliente
                          </div>
                        `}
                      ` : `
                        <div class="text-xs font-medium text-slate-500">
                          ${post.estado === 'ACEPTADA' ? '✓ Asignación formalizada' : '✗ Propuesta desestimada'}
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

  responder(postulacionId, nuevoEstado) {
    const esAceptar = nuevoEstado === 'ACEPTADA';
    const accion = esAceptar ? 'aceptar y formalizar el contrato' : 'rechazar';

    // Usar diálogo modal estilizado no bloqueante
    window.App.confirmar({
      titulo: esAceptar ? 'Confirmar Formalización de Contrato' : 'Rechazar Propuesta',
      mensaje: `¿Estás seguro de que deseas ${accion} para la propuesta #${postulacionId}? ${esAceptar ? 'Se creará una asignación de trabajo. No se realizará ningún pago ni depósito en garantía.' : ''}`,
      icono: esAceptar ? 'verified' : 'cancel',
      textoBoton: esAceptar ? 'Sí, Formalizar Contrato' : 'Rechazar Propuesta',
      tipoBoton: esAceptar ? 'primary' : 'danger',
      onConfirm: async () => {
        try {
          window.App.mostrarToast(`Procesando propuesta #${postulacionId}...`, 'info');
          await window.API.responderPostulacion(postulacionId, nuevoEstado, 'Especialista Senior');

          window.App.mostrarToast(
            esAceptar 
              ? 'Propuesta aceptada y asignación creada.' 
              : 'Postulación rechazada.', 
            'success'
          );

          await window.State.recargarTodo();
        } catch (error) {
          window.App.mostrarToast(`Error: ${error.message}`, 'error');
        }
      }
    });
  }
};

window.ContratosView = ContratosView;