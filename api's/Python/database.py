"""Capa de datos de la parte de Python (Asignacion, horas y Factura).

Hoy es un almacén en memoria: cuando se conecte la base de datos MySQL
(phpMyAdmin) se reescriben los métodos de esta clase con consultas SQL y las
rutas no cambian. Las personas y los proyectos no se guardan aquí: los
gestiona la API de Node.js y se referencian solo por id.
"""

from errors import not_found
from models.asignacion import Asignacion
from models.factura import Factura


class Database:
    def __init__(self):
        self.asignaciones = []
        self.facturas = []
        self.contadores = {"asignacion": 0, "factura": 0}

    def siguiente_id(self, tipo: int) -> int:
        self.contadores[tipo] += 1
        return self.contadores[tipo]

    # ---------------------------------------------------------- Asignaciones
    def crear_asignacion(self, datos: dict):
        asignacion = Asignacion(**datos)
        asignacion.idAsignacion = self.siguiente_id("asignacion")
        self.asignaciones.append(asignacion)
        return asignacion

    def obtener_asignacion(self, id_asignacion):
        asignacion = next(
            (a for a in self.asignaciones if a.idAsignacion == int(id_asignacion)), None
        )
        if asignacion is None:
            raise not_found(f"Asignación {id_asignacion} no encontrada")
        return asignacion

    def asignaciones_de_proyecto(self, id_proyecto):
        return [a for a in self.asignaciones if a.proyectoId == int(id_proyecto)]

    def asignaciones_de_trabajador(self, id_usuario):
        return [a for a in self.asignaciones if a.usuarioId == int(id_usuario)]

    # ------------------------------------------------------------- Facturas
    def crear_factura_desde_asignacion(self, asignacion, cliente_id):
        factura = Factura.generar_factura(
            idFactura=self.siguiente_id("factura"),
            asignacion=asignacion,
            clienteId=cliente_id,
        )
        self.facturas.append(factura)
        return factura

    def obtener_factura(self, id_factura):
        factura = next(
            (f for f in self.facturas if f.idFactura == int(id_factura)), None
        )
        if factura is None:
            raise not_found(f"Factura {id_factura} no encontrada")
        return factura

    def facturas_de_usuario(self, id_usuario):
        return [f for f in self.facturas if f.usuarioId == int(id_usuario)]

    # ------------------------------------------------------------- Utilidades
    def limpiar(self):
        """Vacía el almacén. Se usa en pruebas."""
        self.asignaciones = []
        self.facturas = []
        self.contadores = {"asignacion": 0, "factura": 0}
        return self

    def estadisticas(self):
        return {"asignaciones": len(self.asignaciones), "facturas": len(self.facturas)}


db = Database()
