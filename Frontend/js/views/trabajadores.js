Vistas.trabajadores = {
    async render(contenedor) {
        contenedor.innerHTML = UI.cargando();
        try {
            const [trabajadores, proyectos] = await Promise.all([
                API.trabajadores(), API.proyectos()
            ]);
            this.pintar(contenedor, { trabajadores, proyectos });
        } catch (e) {
            contenedor.innerHTML = UI.error(e.message);
        }
    },

    pintar(contenedor, datos) {
        const { trabajadores, proyectos } = datos;
        const abiertos = proyectos.filter(p => p.estado !== 'CANCELADO' && p.estado !== 'ENTREGADO');

        const filtros = UI.card('Filtros', `
            <div class="p-5 grid gap-3 sm:grid-cols-4">
                ${UI.campo('Especialidad', UI.input('especialidad', '', 'text', 'placeholder="JavaScript, Diseño…"'))}
                ${UI.campo('Disponibilidad', UI.select('disponibilidad', [
                    { valor: '', texto: 'Todos' },
                    { valor: 'true', texto: 'Disponibles' },
                    { valor: 'false', texto: 'No disponibles' }
                ]))}
                <div class="flex items-end gap-2 sm:col-span-2">
                    <button id="t-buscar" class="btn-primario flex-1">Filtrar</button>
                    <button id="t-limpiar" class="btn-sec">Limpiar</button>
                </div>
            </div>`);

        const tabla = UI.tabla([
            { titulo: 'ID', render: t => t.idUsuario },
            {
                titulo: 'Trabajador', render: t => `
                    <div>
                        <p class="font-medium">${UI.esc(t.nombre)}</p>
                        <p class="text-xs text-slate-500">${UI.esc(t.email)} · ${UI.esc(t.telefono || 'sin teléfono')}</p>
                    </div>`
            },
            { titulo: 'Especialidad', render: t => `<span class="badge badge-neutra">${UI.esc(t.especialidad || '—')}</span>` },
            {
                titulo: 'Disponibilidad', render: t => t.disponibilidad
                    ? '<span class="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Disponible</span>'
                    : '<span class="badge bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Ocupado</span>'
            },
            { titulo: 'Tarifa base', render: t => UI.money(t.tarifaPorHoraDefecto) },
            { titulo: 'Postulaciones', render: t => t.postulaciones.length },
            {
                titulo: 'Acciones', render: t => `
                    <div class="flex gap-1 flex-wrap">
                        <button data-postular="${t.idUsuario}" class="btn-sec" ${t.disponibilidad ? '' : 'disabled'}>Postular</button>
                        <button data-historial="${t.idUsuario}" class="btn-sec">Historial</button>
                        <button data-disponibilidad="${t.idUsuario}" data-valor="${!t.disponibilidad}" class="btn-sec">${t.disponibilidad ? 'Marcar ocupado' : 'Marcar disponible'}</button>
                    </div>`
            }
        ], trabajadores, 'No hay trabajadores para estos filtros');

        const postulaciones = UI.tabla([
            { titulo: 'Proyecto', render: t => `#${t.idProyecto}` },
            { titulo: 'Fecha', render: t => UI.fecha(t.fechaPostulacion) },
            { titulo: 'Estado', render: t => `<span class="badge badge-neutra">${UI.esc(t.estado)}</span>` }
        ], [], 'Selecciona un trabajador para ver sus postulaciones');

        contenedor.innerHTML = filtros + UI.card('Trabajadores', tabla) + UI.card('Postulaciones del trabajador seleccionado', `<div id="post-box">${postulaciones}</div>`);

        document.getElementById('t-buscar').addEventListener('click', async () => {
            try {
                const filtrados = await API.trabajadores({
                    especialidad: document.getElementById('especialidad').value,
                    disponibilidad: document.getElementById('disponibilidad').value
                });
                this.pintar(contenedor, { ...datos, trabajadores: filtrados });
            } catch (e) {
                UI.toast(e.message, 'error');
            }
        });

        document.getElementById('t-limpiar').addEventListener('click', () => this.render(contenedor));

        contenedor.querySelectorAll('[data-postular]').forEach(btn => {
            btn.addEventListener('click', () => {
                UI.modal('Postular a proyecto', `
                    <form class="space-y-3">
                        ${UI.campo('Proyecto', UI.select('proyectoId', abiertos.map(p => ({ valor: p.idProyecto, texto: `#${p.idProyecto} · ${p.nombreProyecto}` }))))}
                        <p class="text-xs text-slate-500">Método del diagrama: Trabajador.postularAProyecto()</p>
                    </form>`, async (form) => {
                    await API.postular(btn.dataset.postular, form.proyectoId);
                    UI.toast('Postulación registrada');
                    this.render(contenedor);
                });
            });
        });

        contenedor.querySelectorAll('[data-disponibilidad]').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const valor = btn.dataset.valor === 'true';
                    await API.disponibilidad(btn.dataset.disponibilidad, valor);
                    UI.toast(`Trabajador marcado como ${valor ? 'disponible' : 'ocupado'}`);
                    this.render(contenedor);
                } catch (e) {
                    UI.toast(e.message, 'error');
                }
            });
        });

        contenedor.querySelectorAll('[data-historial]').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const { trabajador, historial } = await API.historial(btn.dataset.historial);
                    document.getElementById('post-box').innerHTML = `
                        <div class="p-5 border-b border-slate-200 dark:border-slate-800">
                            <p class="font-medium">Postulaciones de ${UI.esc(trabajador.nombre)}</p>
                            <p class="text-xs text-slate-500">${UI.esc(trabajador.especialidad || '')}</p>
                        </div>
                        ${UI.tabla([
                            { titulo: 'Proyecto', render: t => `#${t.idProyecto}` },
                            { titulo: 'Fecha', render: t => UI.fecha(t.fechaPostulacion) },
                            { titulo: 'Estado', render: t => `<span class="badge badge-neutra">${UI.esc(t.estado)}</span>` }
                        ], trabajador.postulaciones, 'Sin postulaciones')}
                        <div class="p-3 border-t border-slate-200 dark:border-slate-800">
                            <p class="label">Historial de trabajos</p>
                            ${UI.tabla([
                                { titulo: 'Proyecto', render: t => `#${t.proyectoId}` },
                                { titulo: 'Rol', render: t => UI.esc(t.rolEnProyecto) },
                                { titulo: 'Estado', render: t => UI.estadoTiempo(t.estadoTiempo) },
                                { titulo: 'Horas', render: t => UI.horas(t.horasRegistradas) },
                                { titulo: 'Valor', render: t => UI.money(t.valorTarea) }
                            ], historial, 'Sin trabajos asignados')}
                        </div>`;
                } catch (e) {
                    UI.toast(e.message, 'error');
                }
            });
        });
    }
};
