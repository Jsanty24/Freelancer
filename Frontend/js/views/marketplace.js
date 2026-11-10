/**
 * Freelancer — Vista Marketplace de Proyectos
 * Con Paginación, Ordenamiento, Búsqueda Debounced, RBAC, Empty States y Protección XSS
 */

const MarketplaceView = {
  filtroActual: 'TODOS',
  busqueda: '',
  ordenActual: 'recientes',
  paginaActual: 1,
  itemsPorPagina: 6,

  debouncedSetBusqueda: null,

  init() {
    if (!this.debouncedSetBusqueda) {
      this.debouncedSetBusqueda = window.App.debounce((texto) => {
        this.busqueda = texto;
        this.paginaActual = 1;
        this.render();
      }, 250);
    }
  },

  render() {
    this.init();
    const container = document.getElementById('viewMarketplace');
    if (!container) return;

    const proyectos = window.State.data.proyectos || [];
    const usuarios = window.State.data.usuarios || [];
    const usuarioActivo = window.State.data.usuarioActivo;
    const esCliente = usuarioActivo && usuarioActivo.rol === 'CLIENTE';

    // 1. Filtrar proyectos por categoría y término de búsqueda
    let filtrados = proyectos.filter(p => {
      const coincideTipo = this.filtroActual === 'TODOS' || (p.tipo && p.tipo.toUpperCase() === this.filtroActual);
      const texto = `${p.nombre_proyecto || ''} ${p.descripcion || ''}`.toLowerCase();
      const coincideBusqueda = !this.busqueda || texto.includes(this.busqueda.toLowerCase());
      return coincideTipo && coincideBusqueda;
    });

    // 2. Ordenar proyectos
    filtrados.sort((a, b) => {
      if (this.ordenActual === 'recientes') {
        return (b.id || 0) - (a.id || 0);
      } else if (this.ordenActual === 'antiguos') {
        return (a.id || 0) - (b.id || 0);
      } else if (this.ordenActual === 'alfabetico') {
        return (a.nombre_proyecto || '').localeCompare(b.nombre_proyecto || '');
      } else if (this.ordenActual === 'categoria') {
        return (a.tipo || '').localeCompare(b.tipo || '');
      }
      return 0;
    });

    // 3. Paginación
    const totalItems = filtrados.length;
    const totalPaginas = Math.ceil(totalItems / this.itemsPorPagina) || 1;
    if (this.paginaActual > totalPaginas) this.paginaActual = totalPaginas;
    if (this.paginaActual < 1) this.paginaActual = 1;

    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const paginados = filtrados.slice(inicio, inicio + this.itemsPorPagina);

    container.innerHTML = `
      <!-- Hero de bienvenida & Acciones -->
      <div class="mb-8 bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div class="relative z-10 max-w-3xl">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/20 text-violet-200 text-xs font-semibold uppercase tracking-wider mb-3 border border-violet-400/30">
            <span class="material-symbols-outlined text-[14px]">bolt</span> Red de Talento & Contratos Inteligentes
          </span>
          <h1 class="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Marketplace de Oportunidades</h1>
          <p class="text-violet-200 text-sm sm:text-base leading-relaxed mb-6">
            Explora proyectos publicados y envía propuestas. Los pagos y la custodia de fondos no están integrados.
          </p>
          <div class="flex flex-wrap items-center gap-3">
            ${esCliente ? `
              <button data-csp-click="window.App.abrirModalPublicarProyecto()" class="btn-primary">
                <span class="material-symbols-outlined text-[18px]">add_circle</span> Publicar Nuevo Proyecto
              </button>
            ` : `
              <button data-csp-click="window.App.cambiarVista('talento')" class="btn-primary">
                <span class="material-symbols-outlined text-[18px]">groups</span> Ver Directorio de Talento
              </button>
            `}
            <button data-csp-click="window.App.cambiarVista('contratos')" class="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all flex items-center gap-2 border border-white/15">
              <span class="material-symbols-outlined text-[18px]">description</span> Ver contratos
            </button>
          </div>
        </div>
        <div class="absolute -right-12 -bottom-12 w-64 h-64 bg-violet-600/30 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      <!-- Barra de Filtros, Ordenamiento y Búsqueda -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <!-- Pills de Categorías -->
        <div class="flex flex-wrap items-center gap-2">
          ${[
            { id: 'TODOS', label: 'Todos' },
            { id: 'TECNOLOGIA', label: 'Tecnología' },
            { id: 'DISENO', label: 'Diseño & UI' },
            { id: 'MARKETING', label: 'Marketing B2B' },
            { id: 'REDACCION', label: 'Redacción' },
            { id: 'ASISTENCIA', label: 'Operaciones' }
          ].map(cat => `
            <button
              data-csp-click="MarketplaceView.setFiltro('${cat.id}')"
              class="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                this.filtroActual === cat.id
                  ? 'bg-violet-700 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }">
              ${cat.label}
            </button>
          `).join('')}
        </div>

        <!-- Buscador & Selector de Orden -->
        <div class="flex flex-wrap sm:flex-nowrap items-center gap-3">
          <!-- Ordenamiento -->
          <div class="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap">
            <span class="material-symbols-outlined text-[16px]">sort</span>
            <select
              data-csp-change="MarketplaceView.setOrden(this.value)"
              class="text-xs py-1.5 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-violet-600">
              <option value="recientes" ${this.ordenActual === 'recientes' ? 'selected' : ''}>Más recientes</option>
              <option value="antiguos" ${this.ordenActual === 'antiguos' ? 'selected' : ''}>Más antiguos</option>
              <option value="alfabetico" ${this.ordenActual === 'alfabetico' ? 'selected' : ''}>Título (A-Z)</option>
              <option value="categoria" ${this.ordenActual === 'categoria' ? 'selected' : ''}>Categoría</option>
            </select>
          </div>

          <!-- Buscador con Debounce -->
          <div class="relative w-full sm:w-60">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              id="marketplaceSearchInput"
              type="text"
              value="${window.App.escapeHTML(this.busqueda)}"
              data-csp-input="MarketplaceView.debouncedSetBusqueda(this.value)"
              placeholder="Buscar proyectos..."
              class="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-violet-600 transition-all"
            />
          </div>
        </div>
      </div>

      <!-- Resumen de resultados -->
      <div class="flex items-center justify-between text-xs text-slate-500 mb-4 px-1">
        <span>Mostrando ${totalItems > 0 ? inicio + 1 : 0} - ${Math.min(inicio + this.itemsPorPagina, totalItems)} de <strong>${totalItems}</strong> proyectos</span>
        <span class="font-mono">Página ${this.paginaActual} de ${totalPaginas}</span>
      </div>

      <!-- Grid de Proyectos -->
      ${paginados.length === 0 ? `
        <!-- Empty State Ilustrado -->
        <div class="text-center py-16 bg-white dark:bg-slate-800/60 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8">
          <div class="w-16 h-16 rounded-2xl bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400 mx-auto flex items-center justify-center mb-3">
            <span class="material-symbols-outlined text-[36px]">work_off</span>
          </div>
          <h3 class="text-base font-bold text-slate-800 dark:text-white">No se encontraron proyectos</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            ${this.busqueda ? `No hay resultados para "<strong>${window.App.escapeHTML(this.busqueda)}</strong>".` : 'No hay oportunidades registradas en esta categoría actualmente.'}
          </p>
          <div class="mt-4 flex items-center justify-center gap-3">
            <button data-csp-click="MarketplaceView.limpiarFiltros()" class="btn-secondary text-xs">
              <span class="material-symbols-outlined text-[16px]">restart_alt</span> Limpiar Filtros
            </button>
            ${esCliente ? `
              <button data-csp-click="window.App.abrirModalPublicarProyecto()" class="btn-primary text-xs">
                <span class="material-symbols-outlined text-[16px]">add</span> Publicar el Primer Proyecto
              </button>
            ` : ''}
          </div>
        </div>
      ` : `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          ${paginados.map(proy => {
            const cliente = usuarios.find(u => u.id === proy.cliente_id);
            const nombreCliente = cliente ? cliente.nombre : `Cliente #${proy.cliente_id}`;
            const specs = proy.especificaciones || proy.tecnologia || proy.diseno || proy.redaccion || proy.marketing || proy.asistencia || {};
            const estadoClase = proy.estado === 'ABIERTO' ? 'badge-success' : 'badge-warning';

            return `
              <div class="fl-card p-6 flex flex-col justify-between">
                <div>
                  <div class="flex items-start justify-between gap-3 mb-3">
                    <span class="badge-tech uppercase tracking-wider text-[11px] font-bold">${window.App.escapeHTML(proy.tipo || 'GENERAL')}</span>
                    <span class="${estadoClase}">
                      ${proy.estado === 'ABIERTO' ? 'Disponible para postular' : window.App.escapeHTML(proy.estado)}
                    </span>
                  </div>

                  <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-snug hover:text-violet-700 transition-colors cursor-pointer" data-csp-click="MarketplaceView.verDetalle(${proy.id})">
                    ${window.App.escapeHTML(proy.nombre_proyecto)}
                  </h3>

                  <p class="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed mb-4 line-clamp-3">
                    ${window.App.escapeHTML(proy.descripcion || 'Sin descripción detallada disponible.')}
                  </p>

                  <!-- Especificaciones dinámicas sanitizadas -->
                  <div class="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3 mb-4 text-xs space-y-1.5 border border-slate-100 dark:border-slate-700">
                    <div class="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span class="flex items-center gap-1.5 text-slate-500">
                        <span class="material-symbols-outlined text-[15px]">apartment</span> Solicitante:
                      </span>
                      <span class="font-medium text-slate-800 dark:text-white">${window.App.escapeHTML(nombreCliente)}</span>
                    </div>

                    ${specs.lenguaje_principal ? `
                      <div class="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span class="flex items-center gap-1.5 text-slate-500">
                          <span class="material-symbols-outlined text-[15px]">code</span> Stack:
                        </span>
                        <span class="font-mono font-medium text-violet-700 dark:text-violet-400">${window.App.escapeHTML(specs.lenguaje_principal)}</span>
                      </div>
                    ` : ''}

                    ${specs.software_utilizado ? `
                      <div class="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span class="flex items-center gap-1.5 text-slate-500">
                          <span class="material-symbols-outlined text-[15px]">palette</span> Software:
                        </span>
                        <span class="font-medium text-slate-800 dark:text-white">${window.App.escapeHTML(specs.software_utilizado)}</span>
                      </div>
                    ` : ''}

                    ${specs.cantidad_palabras ? `
                      <div class="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span class="flex items-center gap-1.5 text-slate-500">
                          <span class="material-symbols-outlined text-[15px]">article</span> Extensión:
                        </span>
                        <span class="font-medium text-slate-800 dark:text-white">${window.App.escapeHTML(specs.cantidad_palabras)} palabras (${window.App.escapeHTML(specs.idioma || 'N/A')})</span>
                      </div>
                    ` : ''}

                    ${specs.plataforma_objetivo ? `
                      <div class="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span class="flex items-center gap-1.5 text-slate-500">
                          <span class="material-symbols-outlined text-[15px]">ads_click</span> Plataforma:
                        </span>
                        <span class="font-medium text-slate-800 dark:text-white">${window.App.escapeHTML(specs.plataforma_objetivo)}</span>
                      </div>
                    ` : ''}

                    ${specs.herramientas_manejo ? `
                      <div class="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span class="flex items-center gap-1.5 text-slate-500">
                          <span class="material-symbols-outlined text-[15px]">build</span> Herramientas:
                        </span>
                        <span class="font-medium text-slate-800 dark:text-white">${window.App.escapeHTML(specs.herramientas_manejo)}</span>
                      </div>
                    ` : ''}

                    <div class="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span class="flex items-center gap-1.5 text-slate-500">
                        <span class="material-symbols-outlined text-[15px]">calendar_today</span> Inicio:
                      </span>
                      <span class="font-mono text-slate-700 dark:text-slate-400">${window.App.escapeHTML(proy.fecha_inicio || 'Inmediata')}</span>
                    </div>
                  </div>
                </div>

                <!-- Footer de la tarjeta con acciones & RBAC -->
                <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-xs font-mono">
                    <span class="material-symbols-outlined text-[16px]">info</span> Pagos no integrados
                  </div>

                  <div class="flex items-center gap-2">
                    <button data-csp-click="MarketplaceView.verDetalle(${proy.id})" class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all">
                      Detalles
                    </button>
                    ${proy.estado === 'ABIERTO' ? `
                      ${esCliente ? `
                        <span class="text-[11px] text-slate-400 font-medium px-2">Solo Freelancers</span>
                      ` : `
                        <button data-csp-click="MarketplaceView.abrirModalPostulacion(${proy.id})" class="btn-primary text-xs py-1.5 px-3">
                          <span class="material-symbols-outlined text-[16px]">send</span> Postularme
                        </button>
                      `}
                    ` : `
                      <button disabled class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-medium cursor-not-allowed">
                        En curso
                      </button>
                    `}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Paginación Footer -->
        ${totalPaginas > 1 ? `
          <div class="mt-8 flex items-center justify-center gap-3 font-mono text-xs">
            <button
              data-csp-click="MarketplaceView.cambiarPagina(${this.paginaActual - 1})"
              ${this.paginaActual <= 1 ? 'disabled class="opacity-40 cursor-not-allowed btn-secondary text-xs py-1.5 px-3"' : 'class="btn-secondary text-xs py-1.5 px-3"'}>
              <span class="material-symbols-outlined text-[16px]">arrow_back</span> Anterior
            </button>
            <span class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200">
              Página ${this.paginaActual} de ${totalPaginas}
            </span>
            <button
              data-csp-click="MarketplaceView.cambiarPagina(${this.paginaActual + 1})"
              ${this.paginaActual >= totalPaginas ? 'disabled class="opacity-40 cursor-not-allowed btn-secondary text-xs py-1.5 px-3"' : 'class="btn-secondary text-xs py-1.5 px-3"'}>
              Siguiente <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        ` : ''}
      `}
    `;
  },

  setFiltro(tipo) {
    this.filtroActual = tipo;
    this.paginaActual = 1;
    this.render();
  },

  setOrden(orden) {
    this.ordenActual = orden;
    this.render();
  },

  cambiarPagina(nuevaPagina) {
    this.paginaActual = nuevaPagina;
    this.render();
    window.scrollTo({ top: 380, behavior: 'smooth' });
  },

  limpiarFiltros() {
    this.filtroActual = 'TODOS';
    this.busqueda = '';
    this.paginaActual = 1;
    this.render();
  },

  verDetalle(proyectoId) {
    const proy = (window.State.data.proyectos || []).find(p => p.id === proyectoId);
    if (!proy) return;
    const cliente = (window.State.data.usuarios || []).find(u => u.id === proy.cliente_id);
    const usuarioActivo = window.State.data.usuarioActivo;
    const esTrabajador = usuarioActivo && usuarioActivo.rol === 'TRABAJADOR';

    const modalBody = document.getElementById('genericModalContent');
    const modalTitle = document.getElementById('genericModalTitle');

    if (modalTitle) modalTitle.textContent = proy.nombre_proyecto;
    if (modalBody) {
      const specs = proy.especificaciones || proy.tecnologia || proy.diseno || proy.redaccion || proy.marketing || proy.asistencia || {};

      modalBody.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="badge-tech font-bold uppercase">${window.App.escapeHTML(proy.tipo)}</span>
            <span class="text-xs font-mono text-slate-500">ID: #${proy.id}</span>
          </div>

          <div>
            <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descripción del Proyecto</h4>
            <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
              ${window.App.escapeHTML(proy.descripcion)}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700">
              <span class="text-slate-400 block mb-0.5">Cliente Solicitante</span>
              <span class="font-bold text-slate-800 dark:text-white">${window.App.escapeHTML(cliente ? cliente.nombre : `Cliente #${proy.cliente_id}`)}</span>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700">
              <span class="text-slate-400 block mb-0.5">Estado del Contrato</span>
              <span class="font-bold text-emerald-600">${window.App.escapeHTML(proy.estado)}</span>
            </div>
          </div>

          <div>
            <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Especificaciones de la Categoría</h4>
            <pre class="bg-slate-900 text-slate-100 p-3 rounded-xl text-xs font-mono overflow-x-auto">${window.App.escapeHTML(JSON.stringify(specs, null, 2))}</pre>
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button data-csp-click="window.App.cerrarModalGenerico()" class="btn-secondary text-xs">Cerrar</button>
            ${proy.estado === 'ABIERTO' && esTrabajador ? `
              <button data-csp-click="window.App.cerrarModalGenerico(); MarketplaceView.abrirModalPostulacion(${proy.id})" class="btn-primary text-xs">
                Postularme Ahora
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }

    window.App.abrirModalGenerico();
  },

  abrirModalPostulacion(proyectoId) {
    const proy = (window.State.data.proyectos || []).find(p => p.id === Number(proyectoId));
    const modal = document.getElementById('postulacionModal');
    const proyIdInput = document.getElementById('postulacionProyectoId');
    const proyTituloEl = document.getElementById('postulacionProyectoTitulo');

    if (proyIdInput) proyIdInput.value = proyectoId;
    if (proyTituloEl && proy) proyTituloEl.textContent = proy.nombre_proyecto;
    if (modal) modal.classList.add('open');
  }
};

window.MarketplaceView = MarketplaceView;