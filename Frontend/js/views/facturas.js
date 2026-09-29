Vistas.facturas = {
    async render(contenedor) {
        contenedor.innerHTML = UI.cargando();
        try {
            const [facturas, asignaciones, clientes] = await Promise.all([
                API.facturas(), API.asignaciones(), API.get('/api/clientes')
            ]);
            this.pintar(contenedor, { facturas, asignaciones, clientes });
        } catch (e) {
            contenedor.innerHTML = UI.error(e.message);
        }
    },

    pintar(contenedor, datos) {
        const { facturas, asignaciones, clientes } = datos;

        const porEstado = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'PAGADA'].map(estado => {
            const items = facturas.filter(f => f.estadoFactura === estado);
            return {
                estado,
                total: items.reduce((a, f) => a + f.valorTotal, 0),
                items
            };
        });

        const resumen = `<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            ${porEstado.map(e => `
                <div class="card p-4">
                    <div class="flex items-center justify-between">${UI.estadoFactura(e.estado)}<span class="text-xs text-slate-500">${e.items.length}</span></div>
                    <p class="text-xl font-semibold mt-2">${UI.money(e.total)}</p>
                </div>`).join('')}
        </div>`;

        const facturables = asignaciones.filter(a => a.estadoTiempo !== 'PENDIENTE' && !a.facturaId);
        const generar = `<div class="card p-5 flex flex-wrap items-end gap-3">
            <div class="flex-1 min-w-[240px]">
                ${UI.campo('Asignación a facturar', UI.select('idAsignacion', facturables.map(a => ({ valor: a.idAsignacion, texto: `#${a.idAsignacion} · ${a.rolEnProyecto} · ${UI.horas(a.horasTotales)} · ${UI.money(a.valorTarea)}` }))))}
            </div>
            <div class="flex-1 min-w-[200px]">
                ${UI.campo('Cliente (opcional)', UI.select('idCliente', [{ valor: '', texto: 'Usar el del proyecto' }, ...clientes.map(c => ({ valor: c.idUsuario, texto: `${c.razonSocial || c.nombre} (#${c.idUsuario})` }))]))}
            </div>
            <button id="f-generar" class="btn-primario">Generar factura</button>
        </div>`;

        const tabla = UI.tabla([
            { titulo: '#', render: f => f.idFactura },
            { titulo: 'Emisión', render: f => UI.fecha(f.fechaEmision) },
            {
                titulo: 'Cliente', render: f => {
                    const c = clientes.find(x => x.idUsuario === f.usuarioId);
                    return UI.esc(c ? (c.razonSocial || c.nombre) : `#${f.usuarioId}`);
                }
            },
            { titulo: 'Asignación', render: f => `#${f.asignacionId}` },
            { titulo: 'Horas', render: f => UI.horas(f.horasIncluidas) },
            { titulo: 'Total', render: f => `<b>${UI.money(f.valorTotal)}</b>` },
            { titulo: 'Horas congeladas', render: f => f.horasCongeladas ? '❄️ Sí' : 'No' },
            { titulo: 'Estado', render: f => UI.estadoFactura(f.estadoFactura) },
            {
                titulo: 'Acciones', render: f => `
                    <div class="flex gap-1 flex-wrap">
                        <button data-detalle="${f.idFactura}" class="btn-sec">Detalle</button>
                        <button data-congelar="${f.idFactura}" class="btn-sec" ${f.horasCongeladas || f.estadoFactura !== 'PENDIENTE' ? 'disabled' : ''}>❄ Congelar horas</button>
                        <button data-aprobar="${f.idFactura}" class="btn-sec" ${f.estadoFactura !== 'PENDIENTE' ? 'disabled' : ''}>Aprobar</button>
                        <button data-rechazar="${f.idFactura}" class="btn-sec" ${f.estadoFactura !== 'PENDIENTE' ? 'disabled' : ''}>Rechazar</button>
                        <button data-pagar="${f.idFactura}" class="btn-sec" ${f.estadoFactura !== 'APROBADA' ? 'disabled' : ''}>Pagar</button>
                    </div>`
            }
        ], facturas, 'No hay facturas generadas');

        contenedor.innerHTML = resumen + generar + UI.card('Facturas', tabla);

        document.getElementById('f-generar').addEventListener('click', async () => {
            const idAsignacion = document.getElementById('idAsignacion').value;
            const idCliente = document.getElementById('idCliente').value;
            if (!idAsignacion) {
                UI.toast('No hay asignaciones listas para facturar', 'info');
                return;
            }
            if (!idCliente) {
                UI.toast('Elige el cliente al que se emite la factura', 'info');
                return;
            }
            try {
                const f = await API.generarFactura(idAsignacion, idCliente);
                UI.toast(`Factura #${f.idFactura} por ${UI.money(f.valorTotal)}`);
                this.render(contenedor);
            } catch (e) {
                UI.toast(e.message, 'error');
            }
        });

        contenedor.querySelectorAll('[data-detalle]').forEach(btn => btn.addEventListener('click', async () => {
            try {
                const f = await API.factura(btn.dataset.detalle);
                const root = document.getElementById('modal-root');
                root.innerHTML = `
                    <div class="fixed inset-0 z-50 grid place-items-center p-4 bg-slate-900/60">
                        <div class="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <header class="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex">
                                <h3 class="font-semibold">Factura #${f.idFactura}</h3>
                                <button data-cerrar class="ml-auto">✕</button>
                            </header>
                            <div class="p-5 space-y-3 text-sm">
                                <div class="flex justify-between"><span>Fecha de emisión</span><b>${UI.fecha(f.fechaEmision)}</b></div>
                                <div class="flex justify-between"><span>Cliente</span><b>#${UI.esc(f.usuarioId)}</b></div>
                                <div class="flex justify-between"><span>Asignación</span><b>#${UI.esc(f.asignacionId)}</b></div>
                                <div class="flex justify-between"><span>Estado</span>${UI.estadoFactura(f.estadoFactura)}</div>
                                <div class="flex justify-between"><span>Total horas</span><b>${UI.horas(f.horasIncluidas)}</b></div>
                                <div class="flex justify-between"><span>Horas congeladas</span><b>${f.horasCongeladas ? 'Sí' : 'No'}</b></div>
                                <div class="flex justify-between text-base"><span>Valor total</span><b>${UI.money(f.valorTotal)}</b></div>
                                <div>
                                    <p class="label">Detalle de horas</p>
                                    ${UI.tabla([
                                        { titulo: 'Fecha', render: d => UI.fecha(d.fecha) },
                                        { titulo: 'Origen', render: d => `<span class="badge badge-neutra">${UI.esc(d.origen)}</span>` },
                                        { titulo: 'Descripción', render: d => UI.esc(d.descripcion || '—') },
                                        { titulo: 'Horas', render: d => UI.horas(d.horas) }
                                    ], f.detalle, 'Sin detalle de horas')}
                                </div>
                            </div>
                        </div>
                    </div>`;
                root.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', () => { root.innerHTML = ''; }));
            } catch (e) {
                UI.toast(e.message, 'error');
            }
        }));

        contenedor.querySelectorAll('[data-congelar]').forEach(btn => btn.addEventListener('click', async () => {
            try {
                await API.congelarHorasFactura(btn.dataset.congelar);
                UI.toast('Horas incluidas congeladas');
                this.render(contenedor);
            } catch (e) { UI.toast(e.message, 'error'); }
        }));

        contenedor.querySelectorAll('[data-pagar]').forEach(btn => btn.addEventListener('click', async () => {
            try {
                await API.pagarFactura(btn.dataset.pagar);
                UI.toast('Factura marcada como pagada');
                this.render(contenedor);
            } catch (e) { UI.toast(e.message, 'error'); }
        }));

        contenedor.querySelectorAll('[data-aprobar]').forEach(btn => btn.addEventListener('click', async () => {
            const idFactura = btn.dataset.aprobar;
            const factura = facturas.find(f => f.idFactura === Number(idFactura));
            try {
                await API.aprobarFactura(factura.usuarioId, idFactura);
                UI.toast('Factura aprobada');
                this.render(contenedor);
            } catch (e) { UI.toast(e.message, 'error'); }
        }));

        contenedor.querySelectorAll('[data-rechazar]').forEach(btn => btn.addEventListener('click', () => {
            const idFactura = btn.dataset.rechazar;
            const factura = facturas.find(f => f.idFactura === Number(idFactura));
            UI.modal('Rechazar factura', `
                <form class="space-y-3">
                    ${UI.campo('Motivo', UI.input('motivo', '', 'text', 'placeholder="Motivo del rechazo"'))}
                    <p class="text-xs text-slate-500">Método del diagrama: Cliente.aprobarFactura() / rechazar</p>
                </form>`, async (form) => {
                await API.rechazarFactura(factura.usuarioId, idFactura, form.motivo);
                UI.toast('Factura rechazada');
                this.render(contenedor);
            });
        }));
    }
};
