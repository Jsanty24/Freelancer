"""Enumeración EstadoTiempo (diagrama, punto 6) — conectada a Asignacion."""

from enum import Enum


class EstadoTiempo(Enum):
    PENDIENTE = "PENDIENTE"
    APROBADO = "APROBADO"
    CONGELADO = "CONGELADO"


ESTADOS_TIEMPO = [e.value for e in EstadoTiempo]
