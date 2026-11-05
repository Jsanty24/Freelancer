/**
 * Freelancer — Vista Directorio de Talento Vetted
 * Con Búsqueda Debounced, RBAC, Empty States y Protección XSS
 */

const TalentoView = {
  filtroDisponibilidad: 'TODOS',
  busqueda: '',
  debouncedSetBusqueda: null,

  init() {
    if (!this.debouncedSetBusqueda) {
      this.debouncedSetBusqueda = window.App.debounce((texto) => {
        this.busqueda = texto;
        this.render();
      }, 250);
    }
  },

  render() {
    this.init();
    const container = document.getElementById('viewTalento');
    if (!container) return;

    const trabajadores = window.State.data.trabajadores || [];
    const usuarios = window.State.data.usuarios || [];
    const usuarioActivo = window.State.data.usuarioActivo;
    const esCliente = usuarioActivo && usuarioActivo.rol === 'CLIENTE';

    // Combinar datos
    const talentos = trabajadores.map(t => {
      const u = usuarios.find(usr => usr.id === t.usuario_id);
      return {
        ...t,
        nombre: (u && u.nombre) || t.nombre || `Especialista #${t.usuario_id}`,
        email: (u && u.email) || t.email,
        telefono: (u && u.telefono) || t.telefono,
        disponible: Boolean(t.disponibilidad === 1 || t.disponibilidad === true)
      };
    });

    // Filtrar
    const filtrados = talentos.filter(t => {
      const coincideDisp = this.filtroDisponibilidad === 'TODOS'
        ? true
        : (this.filtroDisponibilidad === 'DISPONIBLE' ? t.disponible : !t.disponible);
      const texto = `${t.nombre || ''} ${t.especialidad || ''}`.toLowerCase();
      const coincideBusqueda = !this.busqueda || texto.includes(this.busqueda.toLowerCase());
      return coincideDisp && coincideBusqueda;
    });

    container.innerHTML = `
      <!-- Header de Talento Vetted -->
      <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-emerald-200 dark:border-emerald-800">
            <span class="material-symbols-outlined text-[15px]">groups</span> Directorio de profesionales
          </span>
          <h2 class="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Directorio de Especialistas Top Tier</h2>
          <p class="text-slate-500 text-sm mt-1 max-w-2xl">
            Ingenieros, arquitectos cloud, diseñadores de producto y especialistas de operaciones evaluados rigurosamente con historial trazable.
          </p>
        </div>

        ${esCliente ? `
          <div class="flex items-center gap-3">
            <button onclick="window.App.abrirModalPublicarProyecto()" class="btn-primary text-xs">
              <span class="material-symbols-outlined text-[16px]">add_circle</span> Crear Proyecto para Talento
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Filtros y Búsqueda -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-2">
          ${[
            { id: 'TODOS', label: 'Todos los Talentos' },
            { id: 'DISPONIBLE', label: 'Disponibles Ahora' },
            { id: 'OCUPADO', label: 'En Proyecto' }
          ].map(f => `
            <button
              onclick="TalentoView.setFiltro('${f.id}')"
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
            oninput="TalentoView.debouncedSetBusqueda(this.value)"
            placeholder="Buscar por nombre o habilidad..."
            class="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-all"
          />
        </div>
      </div>

      <!-- Grid de Especialistas -->
      ${filtrados.length === 0 ? `
        <!-- Empty State Ilustrado -->
        <div class="text-center py-16 bg-white dark:bg-slate-800/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8">
          <div class="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-3">
            <span class="material-symbols-outlined text-[36px]">person_search</span>
          </div>
          <h3 class="text-base font-bold text-slate-800 dark:text-white">No se encontraron especialistas</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Prueba cambiando los filtros de disponibilidad o buscando por otra tecnología.
          </p>
          <div class="mt-4">
            <button onclick="TalentoView.limpiarFiltros()" class="btn-secondary text-xs">
              <span class="material-symbols-outlined text-[16px]">restart_alt</span> Mostrar Todos
            </button>
          </div>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          ${filtrados.map(talento => {
            const iniciales = talento.nombre.split(' ').map(n => n[0]).slice(0, 2).join('');
            const skills = (talento.especialidad || '').split('·').map(s => s.trim());
            const rolPrincipal = skills[0] || 'Especialista Freelance';
            const tags = skills[1] ? skills[1].split(',').map(tag => tag.trim()) : [];

            return `
              <div class="fl-card p-5 flex flex-col justify-between">
                <div>
                  <!-- Top info con Avatar y Status -->
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

                  <!-- Tarifa y Rating -->
                  <div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3 mb-4 border border-slate-100 dark:border-slate-700 text-xs">
                    <div class="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold font-mono">
                      <span class="material-symbols-outlined text-[16px] text-slate-400">star</span>
                      <span class="text-slate-400 font-normal font-sans">Sin calificaciones</span>
                    </div>
                    <div class="text-right">
                      <span class="text-slate-400 block text-[10px] uppercase font-semibold">Tarifa</span>
                      <span class="text-slate-500 dark:text-slate-400 text-xs">Acordada en cada propuesta</span>
                    </div>
                  </div>

                  <!-- Tags de Habilidades -->
                  <div class="flex flex-wrap gap-1.5 mb-4">
                    ${tags.slice(0, 4).map(tg => `
                      <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-mono border border-slate-200 dark:border-slate-700">
                        ${window.App.escapeHTML(tg)}
                      </span>
                    `).join('')}
                  </div>
                </div>

                <!-- Footer acciones & RBAC -->
                <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button onclick="TalentoView.verPerfil(${talento.usuario_id})" class="text-xs text-violet-700 dark:text-violet-400 font-semibold hover:underline flex items-center gap-1">
                    Ver Perfil Completo <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                  ${esCliente ? `
                    <button onclick="TalentoView.asignarDirecto(${talento.usuario_id})" class="btn-primary text-xs py-1.5 px-3">
                      <span class="material-symbols-outlined text-[15px]">handshake</span> Contratar
                    </button>
                  ` : `
                    <span class="text-[11px] text-slate-400 font-medium">Verificado</span>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
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
    const trabajador = (window.State.data.trabajadores || []).find(t => t.usuario_id === Number(usuarioId));
    const usuario = (window.State.data.usuarios || []).find(u => u.id === Number(usuarioId));
    const usuarioActivo = window.State.data.usuarioActivo;
    const esCliente = usuarioActivo && usuarioActivo.rol === 'CLIENTE';

    if (!trabajador && !usuario) return;

    const modalBody = document.getElementById('genericModalContent');
    const modalTitle = document.getElementById('genericModalTitle');

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
              <div class="flex items-center gap-2 mt-1">
                <span class="badge-success text-[10px]">Identidad Verificada</span>
                <span class="badge-tech text-[10px]">Perfil publicado</span>
              </div>
            </div>
          </div>

          <div>
            <h5 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Especialidad & Dominio Técnico</h5>
            <div class="p-3 bg-violet-50/60 dark:bg-violet-950/40 rounded-xl border border-violet-100 dark:border-violet-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-mono">
              ${window.App.escapeHTML(trabajador ? trabajador.especialidad : 'Especialista multidisciplinario')}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700">
              <span class="text-slate-400 block mb-0.5">Disponibilidad Actual</span>
              <span class="font-bold ${trabajador && trabajador.disponibilidad ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}">
                ${trabajador && trabajador.disponibilidad ? 'Inmediata (Tiempo Completo)' : 'Ocupado en Sprint'}
              </span>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700">
              <span class="text-slate-400 block mb-0.5">Pagos y custodia</span>
              <span class="font-bold text-slate-800 dark:text-white">No disponibles</span>
            </div>
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button onclick="window.App.cerrarModalGenerico()" class="btn-secondary text-xs">Cerrar</button>
            ${esCliente ? `
              <button onclick="window.App.cerrarModalGenerico(); TalentoView.asignarDirecto(${usuarioId})" class="btn-primary text-xs">
                Asignar a un Proyecto
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }

    window.App.abrirModalGenerico();
  },

  asignarDirecto(usuarioId) {
    const trabajador = (window.State.data.trabajadores || []).find(t => t.usuario_id === Number(usuarioId));
    const usuario = (window.State.data.usuarios || []).find(u => u.id === Number(usuarioId));
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
        <form id="formAsignarDirecto" onsubmit="TalentoView.guardarAsignacionDirecta(event, ${usuarioId})" class="space-y-4">
          <p class="text-xs text-slate-600 dark:text-slate-300">
            Selecciona el proyecto en el cual deseas vincular a <strong>${window.App.escapeHTML(nombre)}</strong>. Se creará una asignación de trabajo; los pagos no están integrados.
          </p>

          <div>
            <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Proyecto Abierto</label>
            <select id="asigProyectoSelect" required class="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-violet-600">
              ${proyectos.map(p => `
                <option value="${p.id}">${window.App.escapeHTML(p.nombre_proyecto)} (#${p.id})</option>
              `).join('')}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Rol en Proyecto</label>
              <input id="asigRolInput" type="text" value="Especialista Senior" required class="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-violet-600"/>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Tarifa por Hora (USD)</label>
              <input id="asigTarifaInput" type="number" step="0.5" value="75.00" required class="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-violet-600 font-mono"/>
            </div>
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onclick="window.App.cerrarModalGenerico()" class="btn-secondary text-xs">Cancelar</button>
            <button type="submit" class="btn-primary text-xs">Confirmar Contratación</button>
          </div>
        </form>
      `;
    }

    window.App.abrirModalGenerico();
  },

  async guardarAsignacionDirecta(event, usuarioId) {
    event.preventDefault();
    const proyectoId = document.getElementById('asigProyectoSelect').value;
    const rol = document.getElementById('asigRolInput').value;
    const tarifa = document.getElementById('asigTarifaInput').value;

    try {
      window.App.mostrarToast('Creando asignación en microservicio Express (:3000)...', 'info');
      await window.API.crearAsignacion({
        trabajador_id: Number(usuarioId),
        proyecto_id: Number(proyectoId),
        rol_en_proyecto: rol,
        tarifa_por_hora: Number(tarifa)
      });

      window.App.cerrarModalGenerico();
      window.App.mostrarToast('¡Especialista contratado y asignado exitosamente!', 'success');
      await window.State.recargarTodo();
      window.App.cambiarVista('workspace');
    } catch (error) {
      window.App.mostrarToast(`Error: ${error.message}`, 'error');
    }
  }
};

window.TalentoView = TalentoView;