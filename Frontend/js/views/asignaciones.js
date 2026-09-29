Vistas.asignaciones = {
    intervalo: null,

    async render(contenedor) {
        contenedor.innerHTML = UI.cargando();
        try {
            const [asignaciones, proyectos, estados] = await Promise.all([
                API.asignaciones(), API.proyectos(), API.estadosTiempo()
            ]);
            this.pintar(contenedor, { asignaciones, proyectos, estados });
        } catch (e) {
            contenedor.innerHTML = UI.error(e.message);
        }
    },

    pintar(contenedor, datos) {
        const { asignaciones, proyectos, estados } = datos;

        const filtros = UI.card('Filtros', `
            <div class="p-5 grid gap-3 sm:grid-cols-4">
                ${UI.campo('Proyecto', UI.select('proyectoId', [{ valor: '', texto: 'Todos' }, ...proyectos.map(p => ({ valor: p.idProyecto, texto: `#${p.idProyecto} · ${p.nombreProyecto}` }))]))}
                ${UI.campo('Estado del tiempo', UI.select('estadoTiempo', [{ valor: '', texto: 'Todos' }, ...estados.map(e => ({ valor: e, texto: e }))]))}
                <div class="flex items-end gap-2 sm:col-span-2">
                    <button id="a-buscar" class="btn-primario flex-1">Filtrar</button>
                    <button id="a-limpiar" class="btn-sec">Limpiar</button>
                </div>
            </div>`);

        const tabla = UI.tabla([
            { titulo: 'ID', render: a => a.idAsignacion },
            { titulo: 'Proyecto', render: a => `#${a.proyectoId}` },
            { titulo: 'Rol', render: a => UI.esc(a.rolEnProyecto) },
            { titulo: 'Trabajador', render: a => `#${a.usuarioId}` },
            { titulo: 'Tarifa/h', render: a => UI.money(a.tarifaPorHora) },
            { titulo: 'Horas', render: a => UI.horas(a.horasTotales) },
            { titulo: 'Valor', render: a => UI.money(a.valorTarea) },
            { titulo: 'Estado', render: a => UI.estadoTiempo(a.estadoTiempo) },
            {
                titulo: 'Temporizador', render: a => a.temporizadorActivo
                    ? '<span class="badge bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">Corriendo</span>'
                    : '<span class="badge badge-neutra">Detenido</span>'
            },
            { titulo: 'Factura', render: a => a.facturaId ? `#${a.facturaId}` : '—' },
            {
                titulo: 'Acciones', render: a => `
                    <div class="flex gap-1 flex-wrap">
                        <button data-iniciar="${a.idAsignacion}" class="btn-sec" ${a.temporizadorActivo ? 'disabled' : ''}>▶ Iniciar</button>
                        <button data-detener="${a.idAsignacion}" class="btn-sec" ${a.temporizadorActivo ? '' : 'disabled'}>■ Detener</button>
                        <button data-horas="${a.idAsignacion}" class="btn-sec" ${a.estadoTiempo === 'CONGELADO' ? 'disabled' : ''}>+ Horas</button>
                        <button data-valor="${a.idAsignacion}" class="btn-sec">Valor</button>
                        <button data-aprobar="${a.idAsignacion}" class="btn-sec" ${a.estadoTiempo !== 'PENDIENTE' ? 'disabled' : ''}>Aprobar</button>
                        <button data-congelar="${a.idAsignacion}" class="btn-sec" ${a.estadoTiempo !== 'PENDIENTE' ? 'disabled' : ''}>❄ Congelar</button>
                    </div>`
            }
        ], asignaciones, 'No hay asignaciones para estos filtros');

        const reloj = `
            <div class="card p-5 flex items-center gap-4">
                <div class="w-11 h-11 rounded-xl bg-rose-100 dark:bg-rose-500/15 grid place-items-center text-xl">⏱</div>
                <div>
                    <p class="text-xs text-slate-500 dark:text-slate-400">Temporizadores activos</p>
                    <p class="text-lg font-semibold" id="reloj-texto">—</p>
                </div>
                <p class="ml-auto text-xs text-slate-400">Métodos: iniciarTemporizador() / detenerTemporizador()</p>
            </div>`;

        contenedor.innerHTML = filtros + reloj + UI.card('Listado de asignaciones', tabla);

        document.getElementById('a-buscar').addEventListener('click', async () => {
            try {
                const filtradas = await API.asignaciones({
                    proyectoId: document.getElementById('proyectoId').value,
                    estadoTiempo: document.getElementById('estadoTiempo').value
                });
                this.pintar(contenedor, { ...datos, asignaciones: filtradas });
            } catch (e) {
                UI.toast(e.message, 'error');
            }
        });

        document.getElementById('a-limpiar').addEventListener('click', () => this.render(contenedor));

        contenedor.querySelectorAll('[data-iniciar]').forEach(btn => btn.addEventListener('click', async () => {
            try {
                await API.iniciarTemporizador(btn.dataset.iniciar);
                UI.toast('Temporizador iniciado');
                this.render(contenedor);
            } catch (e) { UI.toast(e.message, 'error'); }
        }));

        contenedor.querySelectorAll('[data-detener]').forEach(btn => btn.addEventListener('click', async () => {
            try {
                const r = await API.detenerTemporizador(btn.dataset.detener);
                UI.toast(`Temporizador detenido · ${UI.horas(r.horasRegistradas)} registradas`);
                this.render(contenedor);
            } catch (e) { UI.toast(e.message, 'error'); }
        }));

        contenedor.querySelectorAll('[data-valor]').forEach(btn => btn.addEventListener('click', async () => {
            try {
                const v = await API.valorTarea(btn.dataset.valor);
                UI.toast(`Valor de la tarea: ${UI.money(v.valorTarea)} por ${UI.horas(v.horasTotales)}`);
            } catch (e) { UI.toast(e.message, 'error'); }
        }));

        contenedor.querySelectorAll('[data-aprobar]').forEach(btn => btn.addEventListener('click', async () => {
            try {
                await API.aprobarHoras(btn.dataset.aprobar);
                UI.toast('Horas aprobadas');
                this.render(contenedor);
            } catch (e) { UI.toast(e.message, 'error'); }
        }));

        contenedor.querySelectorAll('[data-congelar]').forEach(btn => btn.addEventListener('click', async () => {
            try {
                await API.congelarRegistros(btn.dataset.congelar);
                UI.toast('Registros congelados (CONGELADO)');
                this.render(contenedor);
            } catch (e) { UI.toast(e.message, 'error'); }
        }));

        contenedor.querySelectorAll('[data-horas]').forEach(btn => btn.addEventListener('click', () => {
            UI.modal('Registrar horas manualmente', `
                <form class="space-y-3">
                    ${UI.campo('Horas', UI.input('horas', '1', 'number', 'min="0.01" step="0.01" required'))}
                    ${UI.campo('Descripción', UI.input('descripcion', '', 'text', 'placeholder="Tarea realizada"'))}
                    <p class="text-xs text-slate-500">Método del diagrama: Asignacion.registrarHorasManual(horas)</p>
                </form>`, async (form) => {
                await API.registrarHoras(btn.dataset.horas, form.horas, form.descripcion);
                UI.toast('Horas registradas');
                this.render(contenedor);
            });
        }));

        this.reloj(asignaciones);
    },

    reloj(asignaciones) {
        if (this.intervalo) clearInterval(this.intervalo);
        const texto = document.getElementById('reloj-texto');
        if (!texto) return;
        const activas = asignaciones.filter(a => a.temporizadorActivo);
        if (activas.length === 0) {
            texto.textContent = 'Ninguno activo';
            return;
        }
        const calcular = () => {
            texto.innerHTML = activas.map(a => {
                const segundos = a.inicioTemporizador
                    ? Math.max(0, (Date.now() - new Date(a.inicioTemporizador).getTime()) / 1000)
                    : 0;
                const h = Math.floor(segundos / 3600);
                const m = Math.floor((segundos % 3600) / 60);
                const s = Math.floor(segundos % 60);
                const reloj = [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
                return `<span class="badge bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 mr-1">#${a.idAsignacion} ${reloj}</span>`;
            }).join('');
        };
        calcular();
        this.intervalo = setInterval(calcular, 1000);
    }
};
