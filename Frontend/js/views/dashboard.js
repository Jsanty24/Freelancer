const VISTAS = {
    dashboard: {
        titulo: 'Dashboard',
        subtitulo: 'Resumen de la plataforma',
        render: (c) => Vistas.dashboard.render(c)
    },
    proyectos: {
        titulo: 'Proyectos',
        subtitulo: 'Proyectos por categoría y su progreso',
        render: (c) => Vistas.proyectos.render(c)
    },
    trabajadores: {
        titulo: 'Trabajadores y postulaciones',
        subtitulo: 'Especialidad, disponibilidad e historial de trabajos',
        render: (c) => Vistas.trabajadores.render(c)
    },
    asignaciones: {
        titulo: 'Asignaciones',
        subtitulo: 'Temporizador, horas registradas y estado de tiempo',
        render: (c) => Vistas.asignaciones.render(c)
    },
    facturas: {
        titulo: 'Facturas',
        subtitulo: 'Generación, congelamiento y aprobación',
        render: (c) => Vistas.facturas.render(c)
    }
};

const Vistas = {
    dashboard: {
        async render(contenedor) {
            contenedor.innerHTML = UI.cargando();
            try {
                const [salud, proyectos, asignaciones, facturas] = await Promise.all([
                    API.health(), API.proyectos(), API.asignaciones(), API.facturas()
                ]);

                const totalHoras = asignaciones.reduce((a, x) => a + (x.horasTotales || 0), 0);
                const totalFacturado = facturas
                    .filter(f => f.estadoFactura !== 'RECHAZADA')
                    .reduce((a, f) => a + (f.valorTotal || 0), 0);
                const pendientesPago = facturas.filter(f => f.estadoFactura === 'PENDIENTE').length;

                const porEstado = ['PENDIENTE', 'APROBADO', 'CONGELADO'].map(estado => ({
                    estado,
                    horas: asignaciones.filter(a => a.estadoTiempo === estado).reduce((s, a) => s + (a.horasTotales || 0), 0)
                }));
                const maxHoras = Math.max(1, ...porEstado.map(e => e.horas));

                const porCategoria = proyectos.reduce((acc, p) => {
                    const tipo = p.categoria ? p.categoria.tipo : 'SIN_CATEGORIA';
                    acc[tipo] = (acc[tipo] || 0) + 1;
                    return acc;
                }, {});

                const tarjetas = [
                    { titulo: 'Proyectos', valor: salud.proyectos, icono: '🗂', color: 'text-brand-500' },
                    { titulo: 'Trabajadores', valor: salud.trabajadores, icono: '👷', color: 'text-violet-500' },
                    { titulo: 'Asignaciones', valor: salud.asignaciones, icono: '⏱', color: 'text-amber-500' },
                    { titulo: 'Facturas', valor: salud.facturas, icono: '🧾', color: 'text-emerald-500' },
                    { titulo: 'Horas registradas', valor: UI.horas(totalHoras), icono: '🕒', color: 'text-sky-500' },
                    { titulo: 'Facturado', valor: UI.money(totalFacturado), icono: '💵', color: 'text-rose-500' }
                ].map(t => `
                    <div class="card p-4 flex items-center gap-3">
                        <div class="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 grid place-items-center text-xl">${t.icono}</div>
                        <div>
                            <p class="text-xs text-slate-500 dark:text-slate-400">${t.titulo}</p>
                            <p class="text-xl font-semibold ${t.color}">${UI.esc(t.valor)}</p>
                        </div>
                    </div>`).join('');

                const barras = porEstado.map(e => `
                    <div class="space-y-1">
                        <div class="flex justify-between items-center text-xs">
                            ${UI.estadoTiempo(e.estado)}
                            <span class="text-slate-500">${UI.horas(e.horas)}</span>
                        </div>
                        <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div class="h-full bg-brand-500 animate-crece" style="width:${(e.horas / maxHoras) * 100}%"></div>
                        </div>
                    </div>`).join('');

                const categorias = Object.entries(porCategoria).map(([tipo, total]) => `
                    <div class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <span class="text-sm">${UI.esc(tipo.replaceAll('_', ' '))}</span>
                        <span class="badge badge-neutra">${total}</span>
                    </div>`).join('') || '<p class="p-4 text-sm text-slate-500">Sin proyectos</p>';

                const recientes = UI.tabla([
                    { titulo: 'Proyecto', render: p => UI.esc(p.nombreProyecto) },
                    { titulo: 'Categoría', render: p => `<span class="text-xs text-slate-500">${UI.esc(p.categoria ? p.categoria.tipo.replaceAll('_', ' ') : '—')}</span>` },
                    { titulo: 'Estado', render: p => UI.estadoProyecto(p.estado) },
                    { titulo: 'Inicio', render: p => UI.fecha(p.fechaInicio) }
                ], [...proyectos].sort((a, b) => new Date(b.fechaInicio) - new Date(a.fechaInicio)).slice(0, 5), 'Sin proyectos');

                const facturasRecientes = UI.tabla([
                    { titulo: '#', render: f => f.idFactura },
                    { titulo: 'Cliente', render: f => `#${UI.esc(f.usuarioId)}` },
                    { titulo: 'Valor', render: f => UI.money(f.valorTotal) },
                    { titulo: 'Estado', render: f => UI.estadoFactura(f.estadoFactura) }
                ], [...facturas].sort((a, b) => b.idFactura - a.idFactura).slice(0, 5), 'Sin facturas');

                contenedor.innerHTML = `
                    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">${tarjetas}</div>
                    <div class="grid gap-4 lg:grid-cols-3">
                        ${UI.card('Horas por estado de tiempo', `<div class="p-5 space-y-3">${barras}</div>`)}
                        ${UI.card('Proyectos por categoría', `<div class="p-3">${categorias}</div>`)}
                        ${UI.card('Facturas recientes', facturasRecientes, '<button class="btn-sec" data-ir="#/facturas">Ver todas</button>')}
                    </div>
                    ${UI.card('Proyectos recientes', recientes, '<button class="btn-sec" data-ir="#/proyectos">Ver todos</button>')}
                    <p class="text-xs text-slate-400 text-center">Node.js :3000 (personas y proyectos) · Python :5000 (asignaciones y facturas) · ${pendientesPago} factura(s) pendiente(s) de aprobación</p>`;

                contenedor.querySelectorAll('[data-ir]').forEach(b =>
                    b.addEventListener('click', () => { location.hash = b.dataset.ir; }));
            } catch (e) {
                contenedor.innerHTML = UI.error(e.message);
            }
        }
    }
};
