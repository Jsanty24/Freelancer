/**
 * Configuración del frontend.
 *
 * Hay dos APIs y cada una gestiona unas entidades distintas sobre la misma
 * base de datos MySQL, así que ya no se elige una: cada pantalla usa la que le
 * toca. Los puertos son configurables por si los cambias al arrancar.
 */
const CONFIG = {
    apis: {
        // Personas y proyectos
        node: localStorage.getItem('apiNode') || 'http://localhost:3000',
        // Asignaciones, horas, temporizador y facturas
        python: localStorage.getItem('apiPython') || 'http://localhost:5000'
    }
};

function guardarConfig(clave, valor) {
    CONFIG.apis[clave] = valor;
    localStorage.setItem(clave === 'node' ? 'apiNode' : 'apiPython', valor);
}
