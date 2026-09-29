"""Servicios de la parte de Python: Asignacion, horas, temporizador y Factura.

Las personas y los proyectos (Usuario, Trabajador, Cliente, Proyecto) los
gestiona la API de Node.js. Aquí solo se Guardan referencias por id, que
apuntarán a las filas de la base de datos MySQL común.
"""

from database import db
from errors import bad_request, conflicto, texto_obligatorio
from models.estado_tiempo import EstadoTiempo


# ------------------------------------------------------------------ Asignaciones
def asociar_asignacion(id_proyecto, datos):
    """+Proyecto.asociarAsignacion(): el proyecto ya existe en la base de datos."""
    usuario_id = texto_obligatorio(datos, "usuarioId")
    activa = [
        a
        for a in db.asignaciones_de_trabajador(usuario_id)
        if a.proyectoId == int(id_proyecto) and a.estadoTiempo != EstadoTiempo.CONGELADO
    ]
    if activa:
        raise conflicto("El trabajador ya tiene una asignación activa en este proyecto")
    tarifa = datos.get("tarifaPorHora")
    if tarifa is None:
        raise bad_request("tarifaPorHora es obligatorio")
    return db.crear_asignacion(
        {
            "rolEnProyecto": texto_obligatorio(datos, "rolEnProyecto"),
            "tarifaPorHora": tarifa,
            "usuarioId": int(usuario_id),
            "proyectoId": int(id_proyecto),
        }
    )


def asignaciones_proyecto(id_proyecto):
    return db.asignaciones_de_proyecto(id_proyecto)


def listar_asignaciones(filtro=None):
    filtro = filtro or {}
    if filtro.get("proyectoId"):
        return db.asignaciones_de_proyecto(filtro["proyectoId"])
    if filtro.get("usuarioId"):
        return db.asignaciones_de_trabajador(filtro["usuarioId"])
    resultado = db.asignaciones
    if filtro.get("estadoTiempo"):
        resultado = [a for a in resultado if a.estadoTiempo.value == filtro["estadoTiempo"]]
    return resultado


def obtener_asignacion(id_asignacion):
    return db.obtener_asignacion(id_asignacion)


# +Asignacion.iniciarTemporizador()
def iniciar_temporizador(id_asignacion):
    return db.obtener_asignacion(id_asignacion).iniciar_temporizador()


# +Asignacion.detenerTemporizador()
def detener_temporizador(id_asignacion):
    return db.obtener_asignacion(id_asignacion).detener_temporizador()


# +Asignacion.registrarHorasManual(horas)
def registrar_horas(id_asignacion, horas, descripcion=None):
    return db.obtener_asignacion(id_asignacion).registrar_horas_manual(horas, descripcion)


# +Asignacion.calcularValorTarea()
def valor_tarea(id_asignacion):
    asignacion = db.obtener_asignacion(id_asignacion)
    return {
        "idAsignacion": asignacion.idAsignacion,
        "horasTotales": asignacion.horas_totales,
        "valorTarea": asignacion.calcular_valor_tarea(),
    }


# +Asignacion.aprobarRegistros()
def aprobar_registros(id_asignacion):
    return db.obtener_asignacion(id_asignacion).aprobar_registros()


# +Asignacion.congelarRegistros()
def congelar_registros(id_asignacion):
    return db.obtener_asignacion(id_asignacion).congelar_registros()


# ------------------------------------------------------------------------ Facturas
def listar_facturas(filtro=None):
    filtro = filtro or {}
    if filtro.get("usuarioId"):
        return db.facturas_de_usuario(filtro["usuarioId"])
    if filtro.get("estadoFactura"):
        return [f for f in db.facturas if f.estadoFactura == filtro["estadoFactura"]]
    return db.facturas


def obtener_factura(id_factura):
    return db.obtener_factura(id_factura)


# +Factura.generarFactura()
def generar_factura(id_asignacion, id_cliente=None):
    if id_cliente is None:
        raise bad_request("idCliente es obligatorio")
    return db.crear_factura_desde_asignacion(
        db.obtener_asignacion(id_asignacion), int(id_cliente)
    )


# +Factura.congelarHorasIncluidas()
def congelar_horas_factura(id_factura):
    return db.obtener_factura(id_factura).congelar_horas_incluidas()


def marcar_factura_pagada(id_factura):
    return db.obtener_factura(id_factura).marcar_pagada()


# El cliente vive en la API de Node, así que la pertenencia se comprueba por id.
def facturas_cliente(id_cliente):
    return db.facturas_de_usuario(id_cliente)


# +Cliente.aprobarFactura()
def aprobar_factura(id_cliente, id_factura):
    factura = db.obtener_factura(id_factura)
    if factura.usuarioId != int(id_cliente):
        raise conflicto("La factura no pertenece a este cliente")
    return factura.aprobar()


# +Cliente.rechazarFactura()
def rechazar_factura(id_cliente, id_factura, motivo=None):
    factura = db.obtener_factura(id_factura)
    if factura.usuarioId != int(id_cliente):
        raise conflicto("La factura no pertenece a este cliente")
    return factura.rechazar(motivo)
