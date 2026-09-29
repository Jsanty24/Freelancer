"""Clase Asignacion (diagrama, punto 5) con temporizador y registros de horas."""

from datetime import datetime, timezone

from errors import bad_request, conflicto, redondear
from models.estado_tiempo import EstadoTiempo


def _ahora():
    return datetime.now(timezone.utc).isoformat()


class Asignacion:
    """-idAsignacion: int, -rolEnProyecto: String, -tarifaPorHora: double,
    -temporizadorActivo: boolean, -estadoTiempo: EstadoTiempo"""

    def __init__(
        self,
        rolEnProyecto=None,
        tarifaPorHora=0,
        usuarioId=None,
        proyectoId=None,
        idAsignacion=None,
        temporizadorActivo=False,
        estadoTiempo=EstadoTiempo.PENDIENTE,
        fechaInicio=None,
        fechaFin=None,
        facturaId=None,
        inicioTemporizador=None,
    ):
        try:
            self.estadoTiempo = EstadoTiempo(estadoTiempo)
        except ValueError:
            raise bad_request(
                "estadoTiempo inválido. Valores permitidos: "
                + ", ".join(e.value for e in EstadoTiempo)
            )
        self.idAsignacion = idAsignacion
        self.rolEnProyecto = rolEnProyecto
        self.tarifaPorHora = float(tarifaPorHora or 0)
        self.temporizadorActivo = bool(temporizadorActivo)
        self.usuarioId = usuarioId
        self.proyectoId = proyectoId
        self.fechaInicio = fechaInicio or _ahora()
        self.fechaFin = fechaFin
        self.facturaId = facturaId
        self.inicioTemporizador = inicioTemporizador
        self.registros = []

    # +iniciarTemporizador() : void
    def iniciar_temporizador(self):
        if self.temporizadorActivo:
            raise conflicto("El temporizador ya está activo en esta asignación")
        if self.estadoTiempo == EstadoTiempo.CONGELADO:
            raise conflicto("No se puede iniciar el temporizador de una asignación congelada")
        self.temporizadorActivo = True
        self.inicioTemporizador = _ahora()
        return self

    # +detenerTemporizador() : void
    def detener_temporizador(self):
        if not self.temporizadorActivo:
            raise conflicto("El temporizador no está activo")
        horas = self.horas_transcurridas()
        self.temporizadorActivo = False
        self.inicioTemporizador = None
        self.registrar_horas(horas, "TEMPORIZADOR", "Sesión cronometrada")
        return {"asignacion": self, "horasRegistradas": horas}

    def horas_transcurridas(self):
        if not self.inicioTemporizador:
            return 0.0
        inicio = datetime.fromisoformat(self.inicioTemporizador)
        delta = datetime.now(timezone.utc) - inicio
        return redondear(max(delta.total_seconds(), 0) / 3600)

    # +registrarHorasManual(horas) : void
    def registrar_horas_manual(self, horas, descripcion=None):
        try:
            h = float(horas)
        except (TypeError, ValueError):
            raise bad_request("horas debe ser un número mayor que 0")
        if h <= 0:
            raise bad_request("horas debe ser un número mayor que 0")
        if self.estadoTiempo == EstadoTiempo.CONGELADO:
            raise conflicto("La asignación está congelada: no admite más registros")
        return self.registrar_horas(h, "MANUAL", descripcion)

    def registrar_horas(self, horas, origen="MANUAL", descripcion=None):
        registro = {
            "horas": redondear(horas),
            "origen": origen,
            "descripcion": descripcion,
            "fecha": _ahora(),
        }
        self.registros.append(registro)
        return registro

    @property
    def horas_totales(self):
        return redondear(sum(r["horas"] for r in self.registros))

    # +calcularValorTarea() : double
    def calcular_valor_tarea(self):
        return redondear(self.horas_totales * self.tarifaPorHora)

    # +congelarRegistros() : void
    def congelar_registros(self):
        if not self.registros:
            raise conflicto("No hay registros de horas que congelar")
        if self.estadoTiempo == EstadoTiempo.CONGELADO:
            raise conflicto("La asignación ya está congelada")
        if self.temporizadorActivo:
            raise conflicto("Detén el temporizador antes de congelar los registros")
        self.estadoTiempo = EstadoTiempo.CONGELADO
        self.fechaFin = _ahora()
        return self

    def aprobar_registros(self):
        if self.estadoTiempo == EstadoTiempo.CONGELADO:
            raise conflicto("Una asignación congelada no se puede aprobar")
        self.estadoTiempo = EstadoTiempo.APROBADO
        return self

    def to_dict(self) -> dict:
        return {
            "idAsignacion": self.idAsignacion,
            "rolEnProyecto": self.rolEnProyecto,
            "tarifaPorHora": self.tarifaPorHora,
            "temporizadorActivo": self.temporizadorActivo,
            "estadoTiempo": self.estadoTiempo.value,
            "usuarioId": self.usuarioId,
            "proyectoId": self.proyectoId,
            "facturaId": self.facturaId,
            "fechaInicio": self.fechaInicio,
            "fechaFin": self.fechaFin,
            "inicioTemporizador": self.inicioTemporizador,
            "horasTotales": self.horas_totales,
            "valorTarea": self.calcular_valor_tarea(),
            "registros": self.registros,
        }
