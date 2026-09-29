(function () {
    const vista = document.getElementById('vista');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    function aplicarTema(guardado) {
        const oscuro = guardado === null
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
            : guardado === 'oscuro';
        document.documentElement.classList.toggle('dark', oscuro);
        localStorage.setItem('tema', oscuro ? 'oscuro' : 'claro');
        document.getElementById('btn-tema').textContent = oscuro ? '☀️ Tema' : '🌙 Tema';
    }

    function marcarNav(nombre) {
        document.querySelectorAll('.nav-link').forEach(a => {
            const activo = a.dataset.view === nombre;
            a.classList.toggle('bg-brand-50', activo);
            a.classList.toggle('dark:bg-brand-500/10', activo);
            a.classList.toggle('text-brand-700', activo);
            a.classList.toggle('dark:text-brand-300', activo);
            a.classList.toggle('text-slate-700', !activo);
            a.classList.toggle('dark:text-slate-300', !activo);
        });
    }

    function rutaActual() {
        const nombre = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
        return VISTAS[nombre] ? nombre : 'dashboard';
    }

    async function enrutar() {
        const nombre = rutaActual();
        const config = VISTAS[nombre];
        marcarNav(nombre);
        document.getElementById('titulo').textContent = config.titulo;
        document.getElementById('subtitulo').textContent = config.subtitulo;
        cerrarMenu();
        await config.render(vista);
    }

    function abrirMenu() {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
    }

    function cerrarMenu() {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    }

    async function verificarApi() {
        const estado = document.getElementById('api-estado');
        estado.textContent = 'Verificando…';
        try {
            const [personas, trabajo] = await Promise.all([
                API.health('node'),
                API.health('python')
            ]);
            estado.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400">● Conectadas</span>
                · ${personas.usuarios} personas · ${trabajo.asignaciones} asignaciones`;
        } catch (e) {
            estado.innerHTML = '<span class="text-rose-500">● Sin conexión</span>';
        }
    }

    document.getElementById('btn-tema').addEventListener('click', () => {
        aplicarTema(document.documentElement.classList.contains('dark') ? 'claro' : 'oscuro');
    });

    document.getElementById('btn-refresh').addEventListener('click', async () => {
        await verificarApi();
        await enrutar();
        UI.toast('Datos actualizados');
    });

    document.getElementById('btn-menu').addEventListener('click', abrirMenu);
    overlay.addEventListener('click', cerrarMenu);

    window.addEventListener('hashchange', enrutar);

    aplicarTema(localStorage.getItem('tema'));
    verificarApi();
    enrutar();
})();
