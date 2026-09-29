"""Rutas de Python: Asignacion, horas, temporizador, EstadoTiempo y Factura.

Esta API es la propietaria de esas entidades. Lo relativo a personas y
proyectos (Usuario, Trabajador, Cliente, Proyecto, Postulacion) lo expone la
API de Node.js en el puerto 3000.
"""

from flask import Blueprint, jsonify, request

from errors import texto_obligatorio
from models.estado_tiempo import ESTADOS_TIEMPO
import servicios as s

api = Blueprint("api", __name__, url_prefix="/api")


def ok(data, estado=200, mensaje=None):
    return jsonify({"ok": True, "mensaje": mensaje, "data": data}), estado


def cuerpo():
    datos = request.get_json(silent=True)
    if not isinstance(datos, dict):
        from errors import bad_request

        raise bad_request("El cuerpo de la petición debe ser un objeto JSON")
    return datos


# ------------------------------------------------------------- EstadoTiempo
@api.get("/estados-tiempo")
def listar_estados_tiempo():
    return ok(ESTADOS_TIEMPO)


# ------------------------------------------------- Asignaciones de proyecto
@api.post("/proyectos/<int:id_proyecto>/asignaciones")
def asociar_asignacion(id_proyecto):
    return ok(s.asociar_asignacion(id_proyecto, cuerpo()), 201, "Asignación asociada al proyecto")


@api.get("/proyectos/<int:id_proyecto>/asignaciones")
def asignaciones_de_proyecto(id_proyecto):
    return ok(s.asignaciones_proyecto(id_proyecto))


# --------------------------------------------------------------- Asignaciones
@api.get("/asignaciones")
def listar_asignaciones():
    return ok(s.listar_asignaciones(request.args.to_dict()))


@api.get("/asignaciones/<int:id_asignacion>")
def obtener_asignacion(id_asignacion):
    return ok(s.obtener_asignacion(id_asignacion))


@api.post("/asignaciones/<int:id_asignacion>/temporizador/iniciar")
def iniciar_temporizador(id_asignacion):
    return ok(s.iniciar_temporizador(id_asignacion), 200, "Temporizador iniciado")


@api.post("/asignaciones/<int:id_asignacion>/temporizador/detener")
def detener_temporizador(id_asignacion):
    return ok(s.detener_temporizador(id_asignacion), 200, "Temporizador detenido")


@api.post("/asignaciones/<int:id_asignacion>/horas")
def registrar_horas(id_asignacion):
    datos = cuerpo()
    registro = s.registrar_horas(
        id_asignacion, datos.get("horas"), datos.get("descripcion")
    )
    return ok(registro, 201, "Horas registradas manualmente")


@api.get("/asignaciones/<int:id_asignacion>/valor")
def valor(id_asignacion):
    return ok(s.valor_tarea(id_asignacion))


@api.put("/asignaciones/<int:id_asignacion>/aprobar")
def aprobar_registros(id_asignacion):
    return ok(s.aprobar_registros(id_asignacion), 200, "Horas aprobadas")


@api.post("/asignaciones/<int:id_asignacion>/congelar")
def congelar_registros(id_asignacion):
    return ok(s.congelar_registros(id_asignacion), 200, "Registros congelados")


# -------------------------------------------------------------------- Facturas
@api.get("/facturas")
def listar_facturas():
    return ok(s.listar_facturas(request.args.to_dict()))


@api.get("/facturas/<int:id_factura>")
def obtener_factura(id_factura):
    return ok(s.obtener_factura(id_factura))


@api.post("/facturas")
def generar_factura():
    datos = cuerpo()
    factura = s.generar_factura(
        texto_obligatorio(datos, "idAsignacion"), datos.get("idCliente")
    )
    return ok(factura, 201, "Factura generada")


@api.post("/facturas/<int:id_factura>/congelar-horas")
def congelar_horas(id_factura):
    return ok(s.congelar_horas_factura(id_factura), 200, "Horas incluidas congeladas")


@api.post("/facturas/<int:id_factura>/pagar")
def pagar_factura(id_factura):
    return ok(s.marcar_factura_pagada(id_factura), 200, "Factura marcada como pagada")


@api.get("/clientes/<int:id_usuario>/facturas")
def facturas_cliente(id_usuario):
    return ok(s.facturas_cliente(id_usuario))


@api.post("/clientes/<int:id_usuario>/facturas/<int:id_factura>/aprobar")
def aprobar_factura(id_usuario, id_factura):
    return ok(s.aprobar_factura(id_usuario, id_factura), 200, "Factura aprobada")


@api.post("/clientes/<int:id_usuario>/facturas/<int:id_factura>/rechazar")
def rechazar_factura(id_usuario, id_factura):
    datos = request.get_json(silent=True) or {}
    return ok(
        s.rechazar_factura(id_usuario, id_factura, datos.get("motivo")),
        200,
        "Factura rechazada",
    )
