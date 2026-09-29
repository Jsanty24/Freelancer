"""Prueba de humo de la parte de Python: Asignacion, horas, temporizador y Factura.

Los usuarios, trabajadores, clientes y proyectos los crea la API de Node.js
(o la base de datos MySQL común), así que aquí se referencian por id.

Ejecutar:  python pruebas/smoke.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import crear_app  # noqa: E402
from database import db  # noqa: E402

fallos = 0
total = 0

ID_PROYECTO = 1
ID_TRABAJADOR = 7
ID_CLIENTE = 1


def check(nombre, condicion, detalle=""):
    global fallos, total
    total += 1
    if condicion:
        print(f"  OK   {nombre}")
    else:
        fallos += 1
        print(f"  FALLA {nombre} {detalle}")


def main():
    global total
    app = crear_app()
    db.limpiar()
    cliente_http = app.test_client()
    total += 1

    def call(metodo, ruta, body=None):
        respuesta = cliente_http.open(
            ruta, method=metodo, json=body if body is not None else {}
        )
        datos = respuesta.get_json(silent=True) or {}
        return {"estado": respuesta.status_code, **datos}

    print("\n1. Proyecto.asociarAsignacion()")
    asignacion = call(
        "POST",
        f"/api/proyectos/{ID_PROYECTO}/asignaciones",
        {
            "usuarioId": ID_TRABAJADOR,
            "rolEnProyecto": "Backend",
            "tarifaPorHora": 50,
        },
    )
    check("asignación asociada (201)", asignacion["estado"] == 201, asignacion)
    id_asignacion = asignacion["data"]["idAsignacion"]
    check(
        "guarda el proyecto y el trabajador",
        asignacion["data"]["proyectoId"] == ID_PROYECTO
        and asignacion["data"]["usuarioId"] == ID_TRABAJADOR,
        asignacion["data"],
    )

    repetida = call(
        "POST",
        f"/api/proyectos/{ID_PROYECTO}/asignaciones",
        {"usuarioId": ID_TRABAJADOR, "rolEnProyecto": "Backend", "tarifaPorHora": 50},
    )
    check("asignación duplicada rechazada (409)", repetida["estado"] == 409, repetida)

    sin_tarifa = call(
        "POST",
        f"/api/proyectos/{ID_PROYECTO}/asignaciones",
        {"usuarioId": 8, "rolEnProyecto": "Frontend"},
    )
    check("tarifa obligatoria (400)", sin_tarifa["estado"] == 400, sin_tarifa)

    print("\n2. Listado y filtrado de asignaciones")
    listado = call("GET", "/api/asignaciones")
    check("asignaciones listadas", listado["estado"] == 200 and len(listado["data"]) == 1)
    por_proyecto = call("GET", f"/api/asignaciones?proyectoId={ID_PROYECTO}")
    check("filtro por proyecto", len(por_proyecto["data"]) == 1)
    por_trabajador = call("GET", f"/api/asignaciones?usuarioId={ID_TRABAJADOR}")
    check("filtro por trabajador", len(por_trabajador["data"]) == 1)
    del_proyecto = call("GET", f"/api/proyectos/{ID_PROYECTO}/asignaciones")
    check("asignaciones del proyecto", len(del_proyecto["data"]) == 1)

    print("\n3. Asignacion.registrarHorasManual() y temporizador")
    horas = call(
        "POST",
        f"/api/asignaciones/{id_asignacion}/horas",
        {"horas": 4, "descripcion": "Modelado"},
    )
    check("horas registradas (201)", horas["estado"] == 201)
    horas_malas = call(
        "POST", f"/api/asignaciones/{id_asignacion}/horas", {"horas": -3}
    )
    check("horas negativas rechazadas (400)", horas_malas["estado"] == 400)

    inicio = call("POST", f"/api/asignaciones/{id_asignacion}/temporizador/iniciar")
    check(
        "temporizador iniciado",
        inicio["estado"] == 200 and inicio["data"]["temporizadorActivo"] is True,
    )
    doble_inicio = call("POST", f"/api/asignaciones/{id_asignacion}/temporizador/iniciar")
    check("doble inicio rechazado (409)", doble_inicio["estado"] == 409)
    fin = call("POST", f"/api/asignaciones/{id_asignacion}/temporizador/detener")
    check(
        "temporizador detenido",
        fin["estado"] == 200
        and fin["data"]["asignacion"]["temporizadorActivo"] is False,
    )

    print("\n4. Asignacion.calcularValorTarea()")
    valor = call("GET", f"/api/asignaciones/{id_asignacion}/valor")
    check(
        "valor calculado",
        valor["estado"] == 200 and valor["data"]["valorTarea"] >= 200,
        valor["data"],
    )

    print("\n5. Factura.generarFactura()")
    pendiente = call("POST", "/api/facturas", {"idAsignacion": id_asignacion})
    check("factura con estado PENDIENTE rechazada (400)", pendiente["estado"] == 400)

    call("PUT", f"/api/asignaciones/{id_asignacion}/aprobar")
    factura = call(
        "POST", "/api/facturas", {"idAsignacion": id_asignacion, "idCliente": ID_CLIENTE}
    )
    check("factura generada (201)", factura["estado"] == 201, factura)
    id_factura = factura["data"]["idFactura"]
    check(
        "valorTotal coincide con la asignación",
        factura["data"]["valorTotal"] == valor["data"]["valorTarea"],
    )
    repetida_factura = call(
        "POST", "/api/facturas", {"idAsignacion": id_asignacion, "idCliente": ID_CLIENTE}
    )
    check("segunda factura bloqueada por relación 1 a 1 (409)", repetida_factura["estado"] == 409)

    print("\n6. Factura.congelarHorasIncluidas()")
    congelada = call("POST", f"/api/facturas/{id_factura}/congelar-horas")
    check(
        "horas congeladas",
        congelada["estado"] == 200 and congelada["data"]["horasCongeladas"] is True,
    )
    doble = call("POST", f"/api/facturas/{id_factura}/congelar-horas")
    check("doble congelamiento rechazado (409)", doble["estado"] == 409)

    print("\n7. Facturas del cliente")
    del_cliente = call("GET", f"/api/clientes/{ID_CLIENTE}/facturas")
    check(
        "facturas del cliente",
        del_cliente["estado"] == 200 and len(del_cliente["data"]) == 1,
        del_cliente["data"],
    )
    otro_cliente = call(
        "POST", f"/api/clientes/99/facturas/{id_factura}/aprobar"
    )
    check("factura de otro cliente rechazada (409)", otro_cliente["estado"] == 409)

    print("\n8. Cliente.aprobarFactura() y pago")
    aprobada = call("POST", f"/api/clientes/{ID_CLIENTE}/facturas/{id_factura}/aprobar")
    check(
        "factura aprobada",
        aprobada["estado"] == 200
        and aprobada["data"]["estadoFactura"] == "APROBADA",
    )
    pagada = call("POST", f"/api/facturas/{id_factura}/pagar")
    check("factura pagada", pagada["estado"] == 200 and pagada["data"]["estadoFactura"] == "PAGADA")

    print("\n9. Factura.rechazar()")
    segunda = call(
        "POST",
        f"/api/proyectos/{ID_PROYECTO}/asignaciones",
        {"usuarioId": 9, "rolEnProyecto": "Diseñador", "tarifaPorHora": 30},
    )
    id_segunda = segunda["data"]["idAsignacion"]
    call("POST", f"/api/asignaciones/{id_segunda}/horas", {"horas": 2})
    call("PUT", f"/api/asignaciones/{id_segunda}/aprobar")
    factura2 = call(
        "POST", "/api/facturas", {"idAsignacion": id_segunda, "idCliente": ID_CLIENTE}
    )
    id_factura2 = factura2["data"]["idFactura"]
    rechazada = call(
        "POST",
        f"/api/clientes/{ID_CLIENTE}/facturas/{id_factura2}/rechazar",
        {"motivo": "Horas incorrectas"},
    )
    check(
        "factura rechazada",
        rechazada["estado"] == 200
        and rechazada["data"]["estadoFactura"] == "RECHAZADA"
        and rechazada["data"]["rechazoMotivo"] == "Horas incorrectas",
    )

    print("\n10. Asignacion.congelarRegistros()")
    congelar = call("POST", f"/api/asignaciones/{id_asignacion}/congelar")
    check(
        "registros congelados",
        congelar["estado"] == 200 and congelar["data"]["estadoTiempo"] == "CONGELADO",
    )
    call("POST", f"/api/asignaciones/{id_asignacion}/horas", {"horas": 1})
    check(
        "no admite horas tras congelar (409)",
        call("POST", f"/api/asignaciones/{id_asignacion}/horas", {"horas": 1})["estado"]
        == 409,
    )

    print("\n11. EstadoTiempo y errores generales")
    estados = call("GET", "/api/estados-tiempo")
    check("enumeración EstadoTiempo", estados["estado"] == 200 and len(estados["data"]) == 3)
    no_existe = call("GET", "/api/asignaciones/9999")
    check("asignación inexistente (404)", no_existe["estado"] == 404)
    ruta_mala = call("GET", "/api/no-existe")
    check("ruta inexistente (404)", ruta_mala["estado"] == 404)
    sin_cliente = call("POST", "/api/facturas", {"idAsignacion": id_asignacion})
    check("idCliente obligatorio (400)", sin_cliente["estado"] == 400)

    print(f"\nResultado: {total - fallos}/{total} verificaciones OK")
    return 0 if fallos == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
