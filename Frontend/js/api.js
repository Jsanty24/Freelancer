/**
 * Cliente HTTP del frontend.
 *
 * Cada método llama a la API que gestiona esa entidad: Node.js (personas y
 * proyectos) o Python (asignaciones, horas y facturas). Así las dos APIs
 * pueden leer la misma base de datos MySQL sin duplicar datos.
 */
const API = {
    base(cual) {
        return CONFIG.apis[cual === 'python' ? 'python' : 'node'].replace(/\/$/, '');
    },

    async request(metodo, ruta, cuerpo, cual = 'node') {
        const opciones = { method: metodo, headers: {} };
        if (cuerpo !== undefined) {
            opciones.headers['Content-Type'] = 'application/json';
            opciones.body = JSON.stringify(cuerpo);
        }

        const url = this.base(cual) + ruta;
        let respuesta;
        try {
            respuesta = await fetch(url, opciones);
        } catch (e) {
            throw new Error(`No se pudo conectar con la API en ${url}`);
        }

        const texto = await respuesta.text();
        let json = {};
        try { json = texto ? JSON.parse(texto) : {}; } catch { json = {}; }

        if (!respuesta.ok) {
            const error = json.error || {};
            const detalle = Array.isArray(error.detalles) && error.detalles.length
                ? ' · ' + error.detalles.map(d => `${d.campo || ''} ${d.mensaje || ''}`.trim()).join(', ')
                : '';
            throw new Error((error.mensaje || `Error ${respuesta.status}`) + detalle);
        }
        return json.data !== undefined ? json.data : json;
    },

    get(ruta, cual) { return this.request('GET', ruta, undefined, cual); },
    post(ruta, cuerpo, cual) { return this.request('POST', ruta, cuerpo ?? {}, cual); },
    put(ruta, cuerpo, cual) { return this.request('PUT', ruta, cuerpo ?? {}, cual); },

    health(cual) { return this.get('/api/health', cual); },

    /* ------------------------- Node.js: personas y proyectos ---------------- */
    proyectos(filtros = {}) { return this.get('/api/proyectos' + this.query(filtros)); },
    proyecto(id) { return this.get(`/api/proyectos/${id}`); },
    progreso(id) { return this.get(`/api/proyectos/${id}/progreso`); },
    categorias() { return this.get('/api/categorias'); },

    trabajadores(filtros = {}) { return this.get('/api/trabajadores' + this.query(filtros)); },
    trabajador(id) { return this.get(`/api/trabajadores/${id}`); },
    historial(id) { return this.get(`/api/trabajadores/${id}/historial`); },
    postular(id, proyectoId) { return this.post(`/api/trabajadores/${id}/postular`, { proyectoId }); },
    disponibilidad(id, valor) { return this.put(`/api/trabajadores/${id}/disponibilidad`, { disponibilidad: valor }); },

    /* ------------- Python: asignaciones, horas, temporizador, facturas ------ */
    estadosTiempo() { return this.get('/api/estados-tiempo', 'python'); },

    asignaciones(filtros = {}) { return this.get('/api/asignaciones' + this.query(filtros), 'python'); },
    asignacion(id) { return this.get(`/api/asignaciones/${id}`, 'python'); },
    valorTarea(id) { return this.get(`/api/asignaciones/${id}/valor`, 'python'); },
    registrarHoras(id, horas, descripcion) { return this.post(`/api/asignaciones/${id}/horas`, { horas, descripcion }, 'python'); },
    iniciarTemporizador(id) { return this.post(`/api/asignaciones/${id}/temporizador/iniciar`, undefined, 'python'); },
    detenerTemporizador(id) { return this.post(`/api/asignaciones/${id}/temporizador/detener`, undefined, 'python'); },
    aprobarHoras(id) { return this.put(`/api/asignaciones/${id}/aprobar`, undefined, 'python'); },
    congelarRegistros(id) { return this.post(`/api/asignaciones/${id}/congelar`, undefined, 'python'); },
    asociarAsignacion(proyectoId, datos) { return this.post(`/api/proyectos/${proyectoId}/asignaciones`, datos, 'python'); },

    facturas(filtros = {}) { return this.get('/api/facturas' + this.query(filtros), 'python'); },
    factura(id) { return this.get(`/api/facturas/${id}`, 'python'); },
    generarFactura(idAsignacion, idCliente) { return this.post('/api/facturas', { idAsignacion, idCliente }, 'python'); },
    congelarHorasFactura(id) { return this.post(`/api/facturas/${id}/congelar-horas`, undefined, 'python'); },
    facturasCliente(idCliente) { return this.get(`/api/clientes/${idCliente}/facturas`, 'python'); },
    aprobarFactura(idCliente, idFactura) { return this.post(`/api/clientes/${idCliente}/facturas/${idFactura}/aprobar`, undefined, 'python'); },
    rechazarFactura(idCliente, idFactura, motivo) { return this.post(`/api/clientes/${idCliente}/facturas/${idFactura}/rechazar`, { motivo }, 'python'); },
    pagarFactura(id) { return this.post(`/api/facturas/${id}/pagar`, undefined, 'python'); },

    query(filtros) {
        const params = new URLSearchParams();
        Object.entries(filtros).forEach(([k, v]) => {
            if (v !== '' && v !== null && v !== undefined) params.set(k, v);
        });
        const s = params.toString();
        return s ? `?${s}` : '';
    }
};
