Vistas.proyectos = {
    async render(contenedor) {
        contenedor.innerHTML = UI.cargando();
        try {
            const [proyectos, categorias, clientes, trabajadores] = await Promise.all([
                API.proyectos(), API.categorias(), API.get('/api/clientes'), API.trabajadores()
            ]);
            this.pintar(contenedor, { proyectos, categorias, clientes, trabajadores });
        } catch (e) {
            contenedor.innerHTML = UI.error(e.message);
        }
    },

    pintar(contenedor, datos) {
        const { proyectos, categorias, clientes, trabajadores } = datos;

        const filtros = UI.card('Filtros y categorías', `
            <div class="p-5 grid gap-3 sm:grid-cols-4">
                ${UI.campo('Categoría', UI.select('tipoCategoria', categorias.map(c => ({ valor: c.tipo, texto: c.tipo.replaceAll('_', ' ') }))))}
                ${UI.campo('Estado', UI.select('estado', ['', 'ABIERTO', 'EN_PROGRESO', 'ENTREGADO', 'CANCELADO'].map(v => ({ valor: v, texto: v || 'Todos' }))))}
                ${UI.campo('Cliente', UI.select('clienteId', [{ valor: '', texto: 'Todos' }, ...clientes.map(c => ({ valor: c.idUsuario, texto: c.razonSocial || c.nombre }))]))}
                <div class="flex items-end gap-2">
                    <button id="f-buscar" class="btn-primario flex-1">Filtrar</button>
                    <button id="f-limpiar" class="btn-sec">Limpiar</button>
                </div>
            </div>
            <div class="px-5 pb-5">
                <p class="label">Categorías disponibles</p>
                <div class="flex flex-wrap gap-2">
                    ${categorias.map(c => `<span class="badge badge-neutra">${UI.esc(c.tipo.replaceAll('_', ' '))}</span>`).join('')}
                </div>
            </div>`);

        const tabla = UI.tabla([
            { titulo: 'ID', render: p => p.idProyecto },
            {
                titulo: 'Proyecto', render: p => `
                    <div>
                        <p class="font-medium">${UI.esc(p.nombreProyecto)}</p>
                        <p class="text-xs text-slate-500">${UI.esc(p.descripcion || '')}</p>
                    </div>`
            },
            { titulo: 'Categoría', render: p => `<span class="text-xs">${UI.esc(p.categoria ? p.categoria.tipo.replaceAll('_', ' ') : '—')}</span>` },
            {
                titulo: 'Cliente', render: p => {
                    const c = clientes.find(x => x.idUsuario === p.clienteId);
                    return UI.esc(c ? (c.razonSocial || c.nombre) : `#${p.clienteId}`);
                }
            },
            { titulo: 'Presupuesto', render: p => UI.money(p.presupuestoEstimado) },
            { titulo: 'Estado', render: p => UI.estadoProyecto(p.estado) },
            { titulo: 'Asignaciones', render: p => p.asignaciones.length },
            { titulo: 'Progreso', render: p => `<button data-progreso="${p.idProyecto}" class="btn-sec">Ver</button>` },
            {
                titulo: 'Acciones', render: p => `
                    <div class="flex gap-1">
                        <button data-asignar="${p.idProyecto}" class="btn-sec">Asignar</button>
                        <button data-facturar="${p.idProyecto}" class="btn-sec">Facturar</button>
                    </div>`
            }
        ], proyectos, 'No hay proyectos para estos filtros');

        contenedor.innerHTML = filtros + UI.card('Listado de proyectos', tabla);

        document.getElementById('f-buscar').addEventListener('click', async () => {
            try {
                const filtrados = await API.proyectos({
                    tipoCategoria: document.getElementById('tipoCategoria').value,
                    estado: document.getElementById('estado').value,
                    clienteId: document.getElementById('clienteId').value
                });
                this.pintar(contenedor, { ...datos, proyectos: filtrados });
            } catch (e) {
                UI.toast(e.message, 'error');
            }
        });

        document.getElementById('f-limpiar').addEventListener('click', () => this.render(contenedor));

        contenedor.querySelectorAll('[data-progreso]').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const p = await API.progreso(btn.dataset.progreso);
                    this.mostrarProgreso(p);
                } catch (e) {
                    UI.toast(e.message, 'error');
                }
            });
        });

        contenedor.querySelectorAll('[data-asignar]').forEach(btn => {
            btn.addEventListener('click', () => {
                UI.modal('Asociar asignación', `
                    <form class="space-y-3">
                        ${UI.campo('Trabajador', UI.select('usuarioId', trabajadores.map(t => ({ valor: t.idUsuario, texto: `${t.nombre} · ${t.especialidad}` }))))}
                        ${UI.campo('Rol en el proyecto', UI.input('rolEnProyecto', 'Desarrollador'))}
                        ${UI.campo('Tarifa por hora (USD)', UI.input('tarifaPorHora', '40', 'number', 'min="1" step="0.01"'))}
                    </form>`, async (form) => {
                    const r = await API.asociarAsignacion(btn.dataset.asignar, form);
                    UI.toast(`Asignación #${r.idAsignacion} creada`);
                    this.render(contenedor);
                });
            });
        });

        contenedor.querySelectorAll('[data-facturar]').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    // La factura la emite el cliente del proyecto (dato de Node.js)
                    const proyecto = proyectos.find(p => p.idProyecto === Number(btn.dataset.facturar));
                    const cliente = clientes.find(c => c.idUsuario === proyecto?.clienteId);
                    const asignaciones = await API.asignaciones({ proyectoId: btn.dataset.facturar });
                    const facturables = asignaciones.filter(a => a.estadoTiempo !== 'PENDIENTE' && !a.facturaId);
                    if (facturables.length === 0) {
                        UI.toast('No hay asignaciones listas para facturar', 'info');
                        return;
                    }
                    UI.modal('Generar factura', `
                        <form class="space-y-3">
                            ${UI.campo('Asignación', UI.select('idAsignacion', facturables.map(a => ({ valor: a.idAsignacion, texto: `#${a.idAsignacion} · ${a.rolEnProyecto} · ${UI.money(a.valorTarea)}` }))))}
                            <p class="text-xs text-slate-500">La factura se genera con el valor total de la asignación (relación 1 a 1) y se emite al cliente del proyecto (${UI.esc(cliente?.nombre || '—')}).</p>
                        </form>`, async (form) => {
                        const f = await API.generarFactura(form.idAsignacion, cliente?.idUsuario);
                        UI.toast(`Factura #${f.idFactura} por ${UI.money(f.valorTotal)}`);
                        location.hash = '#/facturas';
                    });
                } catch (e) {
                    UI.toast(e.message, 'error');
                }
            });
        });
    },

    mostrarProgreso(p) {
        const root = document.getElementById('modal-root');
        root.innerHTML = `
            <div class="fixed inset-0 z-50 grid place-items-center p-4 bg-slate-900/60">
                <div class="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <header class="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex">
                        <h3 class="font-semibold">${UI.esc(p.nombreProyecto)}</h3>
                        <button data-cerrar class="ml-auto">✕</button>
                    </header>
                    <div class="p-5 space-y-3 text-sm">
                        <div class="flex justify-between"><span>Estado</span>${UI.estadoProyecto(p.estado)}</div>
                        <div class="flex justify-between"><span>Categoría</span><span>${UI.esc((p.tipoCategoria || '—').replaceAll('_', ' '))}</span></div>
                        <div class="flex justify-between"><span>Horas totales</span><b>${UI.horas(p.totalHoras)}</b></div>
                        <div class="flex justify-between"><span>Horas completadas</span><b>${UI.horas(p.horasCompletadas)}</b></div>
                        <div class="flex justify-between"><span>Valor facturado</span><b>${UI.money(p.valorFacturado)}</b></div>
                        <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div class="h-full bg-emerald-500" style="width:${p.porcentajeAvance}%"></div>
                        </div>
                        <p class="text-xs text-slate-500">Avance: ${p.porcentajeAvance}%</p>
                        ${UI.tabla([
                            { titulo: 'Rol', render: a => UI.esc(a.rolEnProyecto) },
                            { titulo: 'Trabajador', render: a => `#${a.usuarioId}` },
                            { titulo: 'Estado', render: a => UI.estadoTiempo(a.estadoTiempo) },
                            { titulo: 'Horas', render: a => UI.horas(a.horasTotales) },
                            { titulo: 'Valor', render: a => UI.money(a.valorTarea) }
                        ], p.asignaciones, 'Sin asignaciones')}
                    </div>
                </div>
            </div>`;
        root.querySelectorAll('[data-cerrar]').forEach(b =>
            b.addEventListener('click', () => { root.innerHTML = ''; }));
    }
};
