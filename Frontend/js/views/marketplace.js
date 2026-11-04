/**
 * Freelancer — Vista Marketplace de Proyectos
 */

const MarketplaceView = {
  filtroActual: 'TODOS',
  busqueda: '',

  render() {
    const container = document.getElementById('viewMarketplace');
    if (!container) return;

    const proyectos = window.State.data.proyectos || [];
    const usuarios = window.State.data.usuarios || [];

    // Filtrar proyectos
    const filtrados = proyectos.filter(p => {
      const coincideTipo = this.filtroActual === 'TODOS' || (p.tipo && p.tipo.toUpperCase() === this.filtroActual);
      const texto = `${p.nombre_proyecto || ''} ${p.descripcion || ''}`.toLowerCase();
      const coincideBusqueda = !this.busqueda || texto.includes(this.busqueda.toLowerCase());
      return coincideTipo && coincideBusqueda;
    });

    container.innerHTML = `
      <!-- Hero de bienvenida & Filtros -->
      <div class="mb-8 bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div class="relative z-10 max-w-3xl">
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/20 text-violet-200 text-xs font-semibold uppercase tracking-wider mb-3 border border-violet-400/30">
            <span class="material-symbols-outlined text-[14px]">bolt</span> Red de Talento & Contratos Inteligentes
          </span>
          <h1 class="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Marketplace de Oportunidades</h1>
          <p class="text-violet-200 text-sm sm:text-base leading-relaxed mb-6">
            Explora proyectos verificados con garantía de custodia Escrow. Postúlate con tu propuesta económica o publica un nuevo requerimiento para contratar talento calificado.
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <button onclick="window.App.abrirModalPublicarProyecto()" class="btn-primary">
              <span class="material-symbols-outlined text-[18px]">add_circle</span> Publicar Nuevo Proyecto
            </button>
            <button onclick="window.App.cambiarVista('talento')" class="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-all flex items-center gap-2 border border-white/15">
              <span class="material-symbols-outlined text-[18px]">groups</span> Ver Directorio Vetted
            </button>
          </div>
        </div>
        <div class="absolute -right-12 -bottom-12 w-64 h-64 bg-violet-600/30 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      <!-- Barra de Filtros y Búsqueda -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
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
              onclick="MarketplaceView.setFiltro('${cat.id}')"
              class="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                this.filtroActual === cat.id
                  ? 'bg-violet-700 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }">
              ${cat.label}
            </button>
          `).join('')}
        </div>

        <!-- Contador y Buscador -->
        <div class="flex items-center gap-3">
          <div class="relative w-full sm:w-64">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input 
              type="text" 
              value="${this.busqueda}"
              oninput="MarketplaceView.setBusqueda(this.value)"
              placeholder="Buscar proyectos..." 
              class="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-all"
            />
          </div>
          <span class="text-xs text-slate-500 font-mono whitespace-nowrap">
            ${filtrados.length} ${filtrados.length === 1 ? 'proyecto' : 'proyectos'}
          </span>
        </div>
      </div>

      <!-- Grid de Proyectos -->
      ${filtrados.length === 0 ? `
        <div class="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
          <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">work_off</span>
          <h3 class="text-base font-semibold text-slate-700">No se encontraron proyectos</h3>
          <p class="text-xs text-slate-500 mt-1">Prueba seleccionando otra categoría o limpiando la búsqueda.</p>
        </div>
      ` : `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          ${filtrados.map(proy => {
            const cliente = usuarios.find(u => u.id === proy.cliente_id);
            const nombreCliente = cliente ? cliente.nombre : `Cliente #${proy.cliente_id}`;
            const specs = proy.especificaciones || {};
            const estadoClase = proy.estado === 'ABIERTO' ? 'badge-success' : 'badge-warning';

            return `
              <div class="fl-card p-6 flex flex-col justify-between">
                <div>
                  <div class="flex items-start justify-between gap-3 mb-3">
                    <span class="badge-tech uppercase tracking-wider">${proy.tipo || 'GENERAL'}</span>
                    <span class="${estadoClase}">
                      ${proy.estado === 'ABIERTO' ? 'Disponible para postular' : proy.estado}
                    </span>
                  </div>

                  <h3 class="text-lg font-bold text-slate-900 mb-2 leading-snug hover:text-violet-700 transition-colors cursor-pointer" onclick="MarketplaceView.verDetalle(${proy.id})">
                    ${proy.nombre_proyecto}
                  </h3>

                  <p class="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4 line-clamp-3">
                    ${proy.descripcion || 'Sin descripción detallada disponible.'}
                  </p>

                  <!-- Especificaciones dinámicas -->
                  <div class="bg-slate-50 rounded-xl p-3 mb-4 text-xs space-y-1.5 border border-slate-100">
                    <div class="flex items-center justify-between text-slate-600">
                      <span class="flex items-center gap-1.5 text-slate-500">
                        <span class="material-symbols-outlined text-[15px]">apartment</span> Cliente:
                      </span>
                      <span class="font-medium text-slate-800">${nombreCliente}</span>
                    </div>
                    ${specs.lenguaje_principal ? `
                      <div class="flex items-center justify-between text-slate-600">
                        <span class="flex items-center gap-1.5 text-slate-500">
                          <span class="material-symbols-outlined text-[15px]">code</span> Stack:
                        </span>
                        <span class="font-mono font-medium text-violet-700">${specs.lenguaje_principal}</span>
                      </div>
                    ` : ''}
                    ${specs.software_utilizado ? `
                      <div class="flex items-center justify-between text-slate-600">
                        <span class="flex items-center gap-1.5 text-slate-500">
                          <span class="material-symbols-outlined text-[15px]">palette</span> Software:
                        </span>
                        <span class="font-medium text-slate-800">${specs.software_utilizado}</span>
                      </div>
                    ` : ''}
                    ${specs.herramientas_manejo ? `
                      <div class="flex items-center justify-between text-slate-600">
                        <span class="flex items-center gap-1.5 text-slate-500">
                          <span class="material-symbols-outlined text-[15px]">build</span> Herramientas:
                        </span>
                        <span class="font-medium text-slate-800">${specs.herramientas_manejo}</span>
                      </div>
                    ` : ''}
                    <div class="flex items-center justify-between text-slate-600">
                      <span class="flex items-center gap-1.5 text-slate-500">
                        <span class="material-symbols-outlined text-[15px]">calendar_today</span> Fecha Inicio:
                      </span>
                      <span class="font-mono text-slate-700">${proy.fecha_inicio || 'Inmediata'}</span>
                    </div>
                  </div>
                </div>

                <!-- Footer de la tarjeta con acciones -->
                <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs font-mono">
                    <span class="material-symbols-outlined text-[16px]">verified_user</span> Escrow Protegido
                  </div>

                  <div class="flex items-center gap-2">
                    <button onclick="MarketplaceView.verDetalle(${proy.id})" class="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all">
                      Detalles
                    </button>
                    ${proy.estado === 'ABIERTO' ? `
                      <button onclick="MarketplaceView.abrirModalPostulacion(${proy.id}, '${escape(proy.nombre_proyecto)}')" class="btn-primary text-xs py-1.5 px-3">
                        <span class="material-symbols-outlined text-[16px]">send</span> Postularme
                      </button>
                    ` : `
                      <button disabled class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-xs font-medium cursor-not-allowed">
                        En curso
                      </button>
                    `}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  },

  setFiltro(tipo) {
    this.filtroActual = tipo;
    this.render();
  },

  setBusqueda(texto) {
    this.busqueda = texto;
    this.render();
  },

  verDetalle(proyectoId) {
    const proy = (window.State.data.proyectos || []).find(p => p.id === proyectoId);
    if (!proy) return;
    const cliente = (window.State.data.usuarios || []).find(u => u.id === proy.cliente_id);

    const modalBody = document.getElementById('genericModalContent');
    const modalTitle = document.getElementById('genericModalTitle');

    if (modalTitle) modalTitle.textContent = proy.nombre_proyecto;
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="badge-tech">${proy.tipo}</span>
            <span class="text-xs font-mono text-slate-500">ID: #${proy.id}</span>
          </div>

          <div>
            <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descripción del Proyecto</h4>
            <p class="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
              ${proy.descripcion}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span class="text-slate-400 block mb-0.5">Cliente Solicitante</span>
              <span class="font-bold text-slate-800">${cliente ? cliente.nombre : `Cliente #${proy.cliente_id}`}</span>
            </div>
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span class="text-slate-400 block mb-0.5">Estado del Contrato</span>
              <span class="font-bold text-emerald-600">${proy.estado}</span>
            </div>
          </div>

          ${proy.especificaciones ? `
            <div>
              <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Especificaciones Técnicas</h4>
              <pre class="bg-slate-900 text-slate-100 p-3 rounded-xl text-xs font-mono overflow-x-auto">${JSON.stringify(proy.especificaciones, null, 2)}</pre>
            </div>
          ` : ''}

          <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <button onclick="window.App.cerrarModalGenerico()" class="btn-secondary text-xs">Cerrar</button>
            ${proy.estado === 'ABIERTO' ? `
              <button onclick="window.App.cerrarModalGenerico(); MarketplaceView.abrirModalPostulacion(${proy.id}, '${escape(proy.nombre_proyecto)}')" class="btn-primary text-xs">
                Postularme Ahora
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }

    window.App.abrirModalGenerico();
  },

  abrirModalPostulacion(proyectoId, tituloEscaped) {
    const titulo = unescape(tituloEscaped);
    const modal = document.getElementById('postulacionModal');
    const proyIdInput = document.getElementById('postulacionProyectoId');
    const proyTituloEl = document.getElementById('postulacionProyectoTitulo');

    if (proyIdInput) proyIdInput.value = proyectoId;
    if (proyTituloEl) proyTituloEl.textContent = titulo;
    if (modal) modal.classList.add('open');
  }
};

window.MarketplaceView = MarketplaceView;
