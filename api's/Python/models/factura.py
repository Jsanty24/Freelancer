"""Clase Factura (diagrama, punto 4).

Relaciones: Usuario 1 -> N Factura, Factura 1 -> 1 Asignacion.
"""

from datetime import datetime, timezone

from errors import ApiError, bad_request, conflicto, redondear
from models.estado_tiempo import EstadoTiempo


def _ahora():
    return datetime.now(timezone.utc).isoformat()


class EstadoFactura:
    PENDIENTE = "PENDIENTE"
    APROBADA = "APROBADA"
    RECHAZADA = "RECHAZADA"
    PAGADA = "PAGADA"


class Factura:
    """-idFactura: int, -fechaEmision: Date, -valorTotal: double, -estadoFactura: String"""

    def __init__(self, idFactura=None, usuarioId=None, asignacionId=None):
        self.idFactura = idFactura
        self.fechaEmision = _ahora()
        self.valorTotal = 0.0
        self.estadoFactura = EstadoFactura.PENDIENTE
        self.usuarioId = usuarioId
        self.asignacionId = asignacionId
        self.horasIncluidas = 0.0
        self.detalle = []
        self.horasCongeladas = False
        self.aprobadaEn = None
        self.rechazoMotivo = None

    # +generarFactura() : void
    @staticmethod
    def generar_factura(idFactura, asignacion, clienteId=None):
        if asignacion is None:
            raise bad_request("La asignación es obligatoria")
        if asignacion.estadoTiempo == EstadoTiempo.PENDIENTE:
            raise conflicto(
                "La asignación debe estar APROBADA o CONGELADA antes de generar la factura"
            )
        if asignacion.facturaId:
            raise conflicto("La asignación ya tiene una factura asociada")

        factura = Factura(
            idFactura=idFactura,
            usuarioId=clienteId if clienteId is not None else asignacion.usuarioId,
            asignacionId=asignacion.idAsignacion,
        )
        factura.valorTotal = asignacion.calcular_valor_tarea()
        factura.horasIncluidas = asignacion.horas_totales
        factura.detalle = [dict(r) for r in asignacion.registros]
        asignacion.facturaId = factura.idFactura
        return factura

    # +congelarHorasIncluidas() : void
    def congelar_horas_incluidas(self):
        if self.horasCongeladas:
            raise conflicto("Las horas de esta factura ya fueron congeladas")
        self.horasCongeladas = True
        self.horasIncluidasCongeladasEn = _ahora()
        return self

    def aprobar(self):
        if self.estadoFactura != EstadoFactura.PENDIENTE:
            raise conflicto(f"La factura ya está en estado {self.estadoFactura}")
        self.estadoFactura = EstadoFactura.APROBADA
        self.aprobadaEn = _ahora()
        return self

    def rechazar(self, motivo=None):
        if self.estadoFactura != EstadoFactura.PENDIENTE:
            raise conflicto(f"La factura ya está en estado {self.estadoFactura}")
        self.estadoFactura = EstadoFactura.RECHAZADA
        self.rechazoMotivo = motivo
        return self

    def marcar_pagada(self):
        if self.estadoFactura != EstadoFactura.APROBADA:
            raise conflicto("Solo una factura APROBADA puede marcarse como PAGADA")
        self.estadoFactura = EstadoFactura.PAGADA
        return self

    @property
    def total_horas_detalle(self):
        return redondear(sum(r["horas"] for r in self.detalle))

    def to_dict(self) -> dict:
        return {
            "idFactura": self.idFactura,
            "fechaEmision": self.fechaEmision,
            "valorTotal": self.valorTotal,
            "estadoFactura": self.estadoFactura,
            "usuarioId": self.usuarioId,
            "asignacionId": self.asignacionId,
            "horasIncluidas": self.horasIncluidas,
            "horasCongeladas": self.horasCongeladas,
            "totalHorasDetalle": self.total_horas_detalle,
            "aprobadaEn": self.aprobadaEn,
            "rechazoMotivo": self.rechazoMotivo,
            "detalle": self.detalle,
        }
