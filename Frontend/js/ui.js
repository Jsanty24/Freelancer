const UI = {
    esc(valor) {
        if (valor === null || valor === undefined) return '';
        return String(valor)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    money(valor) {
        const n = Number(valor || 0);
        return n.toLocaleString('es-CO', { style: 'currency', currency: 'USD' });
    },

    horas(valor) {
        return `${Number(valor || 0).toFixed(2).replace(/\.00$/, '')} h`;
    },

    fecha(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        return isNaN(d) ? '—' : d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
    },

    estadoTiempo(valor) {
        const estilos = {
            PENDIENTE: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
            APROBADO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
            CONGELADO: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
        };
        return `<span class="badge ${estilos[valor] || 'badge-neutra'}">${UI.esc(valor || '—')}</span>`;
    },

    estadoFactura(valor) {
        const estilos = {
            PENDIENTE: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
            APROBADA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
            RECHAZADA: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
            PAGADA: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
        };
        return `<span class="badge ${estilos[valor] || 'badge-neutra'}">${UI.esc(valor || '—')}</span>`;
    },

    estadoProyecto(valor) {
        const estilos = {
            ABIERTO: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
            EN_PROGRESO: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
            ENTREGADO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
            CANCELADO: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
        };
        return `<span class="badge ${estilos[valor] || 'badge-neutra'}">${UI.esc(valor || '—')}</span>`;
    },

    tabla(columnas, filas, vacio = 'No hay registros') {
        if (!filas || filas.length === 0) {
            return `<div class="p-10 text-center text-slate-500">${UI.esc(vacio)}</div>`;
        }
        const head = columnas.map(c => `<th class="th">${UI.esc(c.titulo)}</th>`).join('');
        const body = filas.map(fila => {
            const celdas = columnas.map(c => `<td class="td">${c.render(fila)}</td>`).join('');
            return `<tr class="tr">${celdas}</tr>`;
        }).join('');
        return `
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-slate-50 dark:bg-slate-800/50">${filas.length ? `<tr>${head}</tr>` : ''}</thead>
                    <tbody>${body}</tbody>
                </table>
            </div>`;
    },

    card(titulo, contenido, acciones = '') {
        return `
            <section class="card">
                <header class="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 flex-wrap">
                    <h2 class="font-semibold">${UI.esc(titulo)}</h2>
                    <div class="ml-auto flex items-center gap-2">${acciones}</div>
                </header>
                ${contenido}
            </section>`;
    },

    campo(etiqueta, html, extra = '') {
        return `
            <label class="block ${extra}">
                <span class="label">${UI.esc(etiqueta)}</span>
                ${html}
            </label>`;
    },

    input(nombre, valor = '', tipo = 'text', attrs = '') {
        return `<input name="${nombre}" type="${tipo}" value="${UI.esc(valor)}" ${attrs} class="input">`;
    },

    select(nombre, opciones, valorSeleccionado = '', attrs = '') {
        const items = opciones.map(o => {
            const valor = typeof o === 'string' ? o : o.valor;
            const texto = typeof o === 'string' ? o : o.texto;
            const sel = String(valor) === String(valorSeleccionado) ? 'selected' : '';
            return `<option value="${UI.esc(valor)}" ${sel}>${UI.esc(texto)}</option>`;
        }).join('');
        return `<select name="${nombre}" ${attrs} class="input">${items}</select>`;
    },

    modal(titulo, contenidoHTML, alConfirmar) {
        const root = document.getElementById('modal-root');
        root.innerHTML = `
            <div class="fixed inset-0 z-50 grid place-items-center p-4 bg-slate-900/60">
                <div class="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
                    <header class="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center">
                        <h3 class="font-semibold">${UI.esc(titulo)}</h3>
                        <button data-cerrar class="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
                    </header>
                    <div class="p-5 space-y-4">${contenidoHTML}</div>
                    <footer class="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                        <button data-cerrar class="btn-sec">Cancelar</button>
                        <button id="modal-confirmar" class="btn-primario">Guardar</button>
                    </footer>
                </div>
            </div>`;
        const cerrar = () => { root.innerHTML = ''; };
        root.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', cerrar));
        document.getElementById('modal-confirmar').addEventListener('click', async () => {
            const datos = Object.fromEntries(new FormData(root.querySelector('form')).entries());
            try {
                await alConfirmar(datos);
                cerrar();
            } catch (e) {
                UI.toast(e.message, 'error');
            }
        });
    },

    toast(mensaje, tipo = 'ok') {
        const root = document.getElementById('toast-root');
        const colores = {
            ok: 'bg-emerald-600',
            error: 'bg-rose-600',
            info: 'bg-slate-800 dark:bg-slate-700'
        };
        const div = document.createElement('div');
        div.className = `${colores[tipo] || colores.info} text-white text-sm px-4 py-2.5 rounded-lg shadow-lg animate-aparece`;
        div.textContent = mensaje;
        root.appendChild(div);
        setTimeout(() => div.remove(), 3800);
    },

    cargando(texto = 'Cargando…') {
        return `<div class="card p-10 text-center text-slate-500">${UI.esc(texto)}</div>`;
    },

    error(mensaje) {
        return `<div class="card p-8 text-center">
            <p class="text-rose-600 dark:text-rose-400 font-medium">${UI.esc(mensaje)}</p>
            <p class="text-xs text-slate-500 mt-1">Verifica que la API esté encendida y la URL sea correcta.</p>
        </div>`;
    }
};
