"""Pruebas de la API Proyectos (FastAPI + TestClient + base de datos real).

Ejecutar desde la carpeta api's/Python:

    .\\venv\\Scripts\\python.exe -m pytest tests -v
"""

import os
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

import main
from app.auth import JWT_SECRET
from app.database import SessionLocal
from app.models import (
    Asignacion,
    Cliente,
    Postulacion,
    Proyecto,
    RegistroTiempo,
    Trabajador,
    Usuario,
)

ALGORITMO = "HS256"


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------
def token_de(usuario_id: int, rol: str = "CLIENTE", exp_en_minutos: int = 60) -> str:
    payload = {
        "sub": str(usuario_id),
        "rol": rol,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=exp_en_minutos),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITMO)


def crear_usuario(rol: str) -> int:
    db = SessionLocal()
    sufijo = uuid.uuid4().hex[:10]
    usuario = Usuario(
        nombre=f"Usuario {rol} {sufijo}",
        email=f"{rol.lower()}_{sufijo}@pruebas.test",
        telefono="3000000000",
    )
    db.add(usuario)
    db.flush()
    if rol == "CLIENTE":
        db.add(
            Cliente(
                usuario_id=usuario.id,
                razon_social=f"Cliente {sufijo}",
                direccion_facturacion="Calle 1 # 2-3",
            )
        )
    else:
        db.add(Trabajador(usuario_id=usuario.id, especialidad="Pruebas", disponibilidad=True))
    db.commit()
    identificador = usuario.id
    db.close()
    return identificador


def eliminar_usuario(usuario_id: int) -> None:
    db = SessionLocal()
    ids_proyectos = [f[0] for f in db.query(Proyecto.id).filter(Proyecto.usuario_id == usuario_id)]
    if ids_proyectos:
        ids_asignaciones = [
            f[0] for f in db.query(Asignacion.id).filter(Asignacion.proyecto_id.in_(ids_proyectos))
        ]
        if ids_asignaciones:
            db.query(RegistroTiempo).filter(
                RegistroTiempo.asignacion_id.in_(ids_asignaciones)
            ).delete(synchronize_session=False)
            db.query(Asignacion).filter(Asignacion.id.in_(ids_asignaciones)).delete(
                synchronize_session=False
            )
        db.query(Postulacion).filter(Postulacion.proyecto_id.in_(ids_proyectos)).delete(
            synchronize_session=False
        )
        db.query(Proyecto).filter(Proyecto.id.in_(ids_proyectos)).delete(synchronize_session=False)

    db.query(Postulacion).filter(Postulacion.usuario_id == usuario_id).delete(
        synchronize_session=False
    )
    db.query(Cliente).filter(Cliente.usuario_id == usuario_id).delete(synchronize_session=False)
    db.query(Trabajador).filter(Trabajador.usuario_id == usuario_id).delete(
        synchronize_session=False
    )
    db.query(Usuario).filter(Usuario.id == usuario_id).delete(synchronize_session=False)
    db.commit()
    db.close()


def cuerpo_proyecto(**extra) -> dict:
    cuerpo = {
        "nombre_proyecto": "Proyecto de pruebas automatizadas",
        "descripcion": "Creado por pytest",
        "fecha_inicio": "2026-01-15",
        "tecnologia": {
            "lenguaje_principal": "Python",
            "repositorio_url": "https://github.com/plataforma/prueba",
        },
    }
    cuerpo.update(extra)
    return cuerpo


def auth(usuario_id: int, rol: str = "CLIENTE") -> dict:
    return {"Authorization": f"Bearer {token_de(usuario_id, rol)}"}


@pytest.fixture(scope="session")
def client():
    with TestClient(main.app) as instancia:
        yield instancia


@pytest.fixture(scope="session")
def usuarios():
    datos = {
        "cliente": crear_usuario("CLIENTE"),
        "trabajador": crear_usuario("TRABAJADOR"),
    }
    datos["token_cliente"] = token_de(datos["cliente"], "CLIENTE")
    datos["token_trabajador"] = token_de(datos["trabajador"], "TRABAJADOR")
    yield datos
    for identificador in datos.values():
        if isinstance(identificador, int):
            eliminar_usuario(identificador)


@pytest.fixture
def otro_cliente():
    identificador = crear_usuario("CLIENTE")
    yield identificador
    eliminar_usuario(identificador)


# ---------------------------------------------------------------------------
# Rutas publicas y autenticacion
# ---------------------------------------------------------------------------
def test_raiz_y_health_no_piden_token(client):
    raiz = client.get("/")
    assert raiz.status_code == 200
    assert raiz.json() == {"status": "ok", "service": "API Proyectos"}

    salud = client.get("/health")
    assert salud.status_code == 200
    assert salud.json()["database"] == "ok"


def test_sin_token_responde_401(client):
    respuesta = client.get("/proyectos")
    assert respuesta.status_code == 401
    assert respuesta.json() == {
        "status": "error",
        "message": "Falta el token de autenticacion. Envia Authorization: Bearer <token>",
    }
    assert respuesta.headers.get("www-authenticate") == "Bearer"


def test_token_vencido_responde_401(client, usuarios):
    vencido = token_de(usuarios["cliente"], "CLIENTE", exp_en_minutos=-5)
    respuesta = client.get("/proyectos", headers={"Authorization": f"Bearer {vencido}"})
    assert respuesta.status_code == 401
    assert respuesta.json()["message"] == "El token ha expirado"


def test_token_de_otro_secreto_responde_401(client):
    ajeno = jwt.encode(
        {"sub": "1", "rol": "CLIENTE", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        "secreto-distinto-y-largo-para-la-prueba-0123456789",
        algorithm=ALGORITMO,
    )
    respuesta = client.get("/proyectos", headers={"Authorization": f"Bearer {ajeno}"})
    assert respuesta.status_code == 401
    assert "Token invalido" in respuesta.json()["message"]


# ---------------------------------------------------------------------------
# Crear proyecto
# ---------------------------------------------------------------------------
def test_trabajador_no_puede_crear_proyecto(client, usuarios):
    respuesta = client.post("/proyectos", json=cuerpo_proyecto(), headers=auth(usuarios["trabajador"], "TRABAJADOR"))
    assert respuesta.status_code == 403
    assert respuesta.json()["status"] == "error"
    assert "CLIENTE" in respuesta.json()["message"]


def test_crear_proyecto_ok(client, usuarios):
    respuesta = client.post(
        "/proyectos", json=cuerpo_proyecto(), headers=auth(usuarios["cliente"])
    )
    assert respuesta.status_code == 201
    dato = respuesta.json()
    assert dato["usuario_id"] == usuarios["cliente"]
    assert dato["tipo_proyecto"] == "TecnologiaYProgramacion"
    assert dato["categoria"] == "TecnologiaYProgramacion"
    assert dato["estado"] == "ABIERTO"
    assert dato["especificaciones"]["lenguaje_principal"] == "Python"


def test_crear_sin_categoria_responde_422(client, usuarios):
    cuerpo = cuerpo_proyecto()
    cuerpo.pop("tecnologia")
    respuesta = client.post("/proyectos", json=cuerpo, headers=auth(usuarios["cliente"]))
    assert respuesta.status_code == 422
    assert respuesta.json()["status"] == "error"
    assert "exactamente una categoria" in str(respuesta.json()["errors"])


def test_crear_con_dos_categorias_responde_422(client, usuarios):
    cuerpo = cuerpo_proyecto(diseno={"software_utilizado": "Figma", "formato_entrega": "PNG"})
    respuesta = client.post("/proyectos", json=cuerpo, headers=auth(usuarios["cliente"]))
    assert respuesta.status_code == 422
    assert "exactamente una categoria" in str(respuesta.json()["errors"])


def test_crear_con_usuario_inexistente_responde_404(client):
    token_fantasma = token_de(999999, "CLIENTE")
    respuesta = client.post(
        "/proyectos",
        json=cuerpo_proyecto(),
        headers={"Authorization": f"Bearer {token_fantasma}"},
    )
    assert respuesta.status_code == 404
    assert "no existe" in respuesta.json()["message"]


def test_crear_con_url_invalida_responde_422(client, usuarios):
    cuerpo = cuerpo_proyecto(
        tecnologia={"lenguaje_principal": "Python", "repositorio_url": "sin-esquema"}
    )
    respuesta = client.post("/proyectos", json=cuerpo, headers=auth(usuarios["cliente"]))
    assert respuesta.status_code == 422


def test_crear_con_cuerpo_incompleto_responde_422(client, usuarios):
    respuesta = client.post(
        "/proyectos",
        json={"nombre_proyecto": "Sin fecha"},
        headers=auth(usuarios["cliente"]),
    )
    assert respuesta.status_code == 422
    assert respuesta.json()["status"] == "error"
    assert respuesta.json()["errors"][0]["tipo"] == "missing"


# ---------------------------------------------------------------------------
# Modificar proyecto
# ---------------------------------------------------------------------------
def _proyecto_del_cliente(client, usuarios) -> int:
    respuesta = client.post(
        "/proyectos",
        json=cuerpo_proyecto(nombre_proyecto="Proyecto a modificar"),
        headers=auth(usuarios["cliente"]),
    )
    assert respuesta.status_code == 201
    return respuesta.json()["id"]


def test_cliente_ajeno_no_puede_modificar(client, usuarios, otro_cliente):
    proyecto_id = _proyecto_del_cliente(client, usuarios)
    respuesta = client.patch(
        f"/proyectos/{proyecto_id}",
        json={"descripcion": "Intento ajeno"},
        headers=auth(otro_cliente),
    )
    assert respuesta.status_code == 403
    assert "propietario" in respuesta.json()["message"]


def test_trabajador_no_puede_modificar(client, usuarios):
    proyecto_id = _proyecto_del_cliente(client, usuarios)
    respuesta = client.put(
        f"/proyectos/{proyecto_id}",
        json={"nombre_proyecto": "Nuevo", "descripcion": "x", "estado": "EN_CURSO"},
        headers=auth(usuarios["trabajador"], "TRABAJADOR"),
    )
    assert respuesta.status_code == 403


def test_put_con_nombre_null_responde_422(client, usuarios):
    proyecto_id = _proyecto_del_cliente(client, usuarios)
    respuesta = client.put(
        f"/proyectos/{proyecto_id}",
        json={"nombre_proyecto": None, "descripcion": "x", "estado": "EN_CURSO"},
        headers=auth(usuarios["cliente"]),
    )
    assert respuesta.status_code == 422
    assert respuesta.json()["status"] == "error"


def test_put_reemplazo_completo(client, usuarios):
    proyecto_id = _proyecto_del_cliente(client, usuarios)
    respuesta = client.put(
        f"/proyectos/{proyecto_id}",
        json={
            "nombre_proyecto": "Proyecto reemplazado",
            "descripcion": "Descripcion nueva",
            "estado": "EN_CURSO",
        },
        headers=auth(usuarios["cliente"]),
    )
    assert respuesta.status_code == 200
    dato = respuesta.json()
    assert dato["nombre_proyecto"] == "Proyecto reemplazado"
    assert dato["estado"] == "EN_CURSO"
    assert dato["fecha_inicio"] == "2026-01-15"


def test_put_incompleto_responde_422(client, usuarios):
    proyecto_id = _proyecto_del_cliente(client, usuarios)
    respuesta = client.put(
        f"/proyectos/{proyecto_id}",
        json={"nombre_proyecto": "Solo el nombre"},
        headers=auth(usuarios["cliente"]),
    )
    assert respuesta.status_code == 422


def test_patch_parcial_correcto(client, usuarios):
    proyecto_id = _proyecto_del_cliente(client, usuarios)
    respuesta = client.patch(
        f"/proyectos/{proyecto_id}",
        json={"descripcion": "Solo cambia la descripcion"},
        headers=auth(usuarios["cliente"]),
    )
    assert respuesta.status_code == 200
    dato = respuesta.json()
    assert dato["descripcion"] == "Solo cambia la descripcion"
    assert dato["nombre_proyecto"] == "Proyecto a modificar"
    assert dato["estado"] == "ABIERTO"


def test_patch_con_nombre_null_responde_422(client, usuarios):
    proyecto_id = _proyecto_del_cliente(client, usuarios)
    respuesta = client.patch(
        f"/proyectos/{proyecto_id}",
        json={"nombre_proyecto": None},
        headers=auth(usuarios["cliente"]),
    )
    assert respuesta.status_code == 422


def test_transicion_de_estado_no_permitida_responde_409(client, usuarios):
    proyecto_id = _proyecto_del_cliente(client, usuarios)

    primero = client.patch(
        f"/proyectos/{proyecto_id}",
        json={"estado": "EN_CURSO"},
        headers=auth(usuarios["cliente"]),
    )
    assert primero.status_code == 200

    completado = client.patch(
        f"/proyectos/{proyecto_id}",
        json={"estado": "COMPLETADO"},
        headers=auth(usuarios["cliente"]),
    )
    assert completado.status_code == 200

    reintento = client.patch(
        f"/proyectos/{proyecto_id}",
        json={"estado": "ABIERTO"},
        headers=auth(usuarios["cliente"]),
    )
    assert reintento.status_code == 409
    assert "no permitido" in reintento.json()["message"]


# ---------------------------------------------------------------------------
# Listar proyectos (filtros y paginacion)
# ---------------------------------------------------------------------------
def test_listar_con_filtros_y_paginacion(client, usuarios):
    cliente = usuarios["cliente"]
    ids = []
    for numero in range(2):
        respuesta = client.post(
            "/proyectos",
            json=cuerpo_proyecto(nombre_proyecto=f"Proyecto paginado {numero}"),
            headers=auth(cliente),
        )
        assert respuesta.status_code == 201
        ids.append(respuesta.json()["id"])

    primera = client.get(
        f"/proyectos?cliente={cliente}&limit=1&offset=0", headers=auth(cliente)
    )
    assert primera.status_code == 200
    paginado = primera.json()
    assert paginado["total"] >= 2
    assert paginado["limit"] == 1
    assert paginado["offset"] == 0
    assert len(paginado["items"]) == 1

    segunda = client.get(
        f"/proyectos?cliente={cliente}&limit=1&offset=1", headers=auth(cliente)
    )
    assert segunda.status_code == 200
    assert segunda.json()["items"][0]["id"] != paginado["items"][0]["id"]

    por_categoria = client.get(
        f"/proyectos?cliente={cliente}&categoria=TecnologiaYProgramacion", headers=auth(cliente)
    )
    assert por_categoria.status_code == 200
    assert por_categoria.json()["total"] >= 2
    assert all(i["categoria"] == "TecnologiaYProgramacion" for i in por_categoria.json()["items"])

    por_estado = client.get(f"/proyectos?cliente={cliente}&estado=ABIERTO", headers=auth(cliente))
    assert por_estado.status_code == 200
    assert all(i["estado"] == "ABIERTO" for i in por_estado.json()["items"])

    por_estado_ajeno = client.get(
        f"/proyectos?cliente={cliente}&estado=ESTADO_INVENTADO", headers=auth(cliente)
    )
    assert por_estado_ajeno.status_code == 422

    for identificador in ids:
        client.delete(f"/proyectos/{identificador}", headers=auth(cliente))


def test_proyecto_inexistente_responde_404(client, usuarios):
    respuesta = client.get("/proyectos/999999", headers=auth(usuarios["cliente"]))
    assert respuesta.status_code == 404
    assert respuesta.json() == {"status": "error", "message": "Proyecto no encontrado"}


# ---------------------------------------------------------------------------
# Eliminar
# ---------------------------------------------------------------------------
def test_eliminar_proyecto_sin_asignaciones(client, usuarios):
    proyecto_id = _proyecto_del_cliente(client, usuarios)
    borrado = client.delete(f"/proyectos/{proyecto_id}", headers=auth(usuarios["cliente"]))
    assert borrado.status_code == 204

    consulta = client.get(f"/proyectos/{proyecto_id}", headers=auth(usuarios["cliente"]))
    assert consulta.status_code == 404


def test_eliminar_proyecto_con_asignaciones_responde_409(client, usuarios):
    proyecto_id = _proyecto_del_cliente(client, usuarios)

    db = SessionLocal()
    db.add(
        Asignacion(
            usuario_id=usuarios["trabajador"],
            proyecto_id=proyecto_id,
            rol_en_proyecto="Desarrollador",
            tarifa_por_hora=25000,
        )
    )
    db.commit()
    db.close()

    borrado = client.delete(f"/proyectos/{proyecto_id}", headers=auth(usuarios["cliente"]))
    assert borrado.status_code == 409
    assert "asignacion" in borrado.json()["message"]
    assert "CANCELADO" in borrado.json()["message"]

    consulta = client.get(f"/proyectos/{proyecto_id}", headers=auth(usuarios["cliente"]))
    assert consulta.status_code == 200, "el proyecto no debe haberse borrado"


def test_listar_asignaciones_del_proyecto(client, usuarios):
    proyecto_id = _proyecto_del_cliente(client, usuarios)
    db = SessionLocal()
    db.add(
        Asignacion(
            usuario_id=usuarios["trabajador"],
            proyecto_id=proyecto_id,
            rol_en_proyecto="QA",
            tarifa_por_hora=30000,
        )
    )
    db.commit()
    db.close()

    respuesta = client.get(f"/proyectos/{proyecto_id}/asignaciones", headers=auth(usuarios["cliente"]))
    assert respuesta.status_code == 200
    assert len(respuesta.json()) == 1
    assert respuesta.json()[0]["rol_en_proyecto"] == "QA"


# ---------------------------------------------------------------------------
# Progreso
# ---------------------------------------------------------------------------
def test_consultar_progreso(client, usuarios):
    proyecto_id = _proyecto_del_cliente(client, usuarios)

    db = SessionLocal()
    asignacion = Asignacion(
        usuario_id=usuarios["trabajador"],
        proyecto_id=proyecto_id,
        rol_en_proyecto="Desarrollador",
        tarifa_por_hora=50000,
    )
    db.add(asignacion)
    db.flush()
    db.add(
        RegistroTiempo(
            asignacion_id=asignacion.id,
            horas=4,
            origen="MANUAL",
            estado="APROBADO",
        )
    )
    db.add(
        RegistroTiempo(
            asignacion_id=asignacion.id,
            horas=2,
            origen="TEMPORIZADOR",
            estado="PENDIENTE",
        )
    )
    db.commit()
    db.close()

    respuesta = client.get(f"/proyectos/{proyecto_id}/progreso", headers=auth(usuarios["cliente"]))
    assert respuesta.status_code == 200
    dato = respuesta.json()
    assert dato["proyecto_id"] == proyecto_id
    assert dato["dias_activo"] >= 0
    assert float(dato["horas_aprobadas"]) == 4.0
    assert float(dato["horas_pendientes"]) == 2.0
    assert dato["numero_asignaciones"] == 1
    assert float(dato["costo_acumulado"]) == 300000.0
    assert dato["tipo_proyecto"] == "TecnologiaYProgramacion"
    assert dato["detalles_especialidad"]["lenguaje_principal"] == "Python"


# ---------------------------------------------------------------------------
# Postulaciones
# ---------------------------------------------------------------------------
def test_flujo_de_postulaciones(client, usuarios, otro_cliente):
    cliente = usuarios["cliente"]
    trabajador = usuarios["trabajador"]

    creacion = client.post(
        "/proyectos",
        json=cuerpo_proyecto(nombre_proyecto="Proyecto con postulaciones"),
        headers=auth(cliente),
    )
    assert creacion.status_code == 201
    proyecto_id = creacion.json()["id"]

    # 1. el trabajador se postula
    postulacion = client.post(
        f"/proyectos/{proyecto_id}/postulaciones",
        json={"tarifa_por_hora": 45000, "mensaje": "Tengo experiencia"},
        headers=auth(trabajador, "TRABAJADOR"),
    )
    assert postulacion.status_code == 201
    postulacion_id = postulacion.json()["id"]
    assert postulacion.json()["estado"] == "PENDIENTE"

    # 2. no se puede postular dos veces
    duplicada = client.post(
        f"/proyectos/{proyecto_id}/postulaciones",
        json={"tarifa_por_hora": 50000},
        headers=auth(trabajador, "TRABAJADOR"),
    )
    assert duplicada.status_code == 409
    assert "postulaste" in duplicada.json()["message"]

    # 3. solo el cliente dueno ve las postulaciones
    ajeno = client.get(f"/proyectos/{proyecto_id}/postulaciones", headers=auth(otro_cliente))
    assert ajeno.status_code == 403

    dueno = client.get(f"/proyectos/{proyecto_id}/postulaciones", headers=auth(cliente))
    assert dueno.status_code == 200
    assert len(dueno.json()) == 1

    # 4. el cliente acepta
    aceptada = client.patch(
        f"/postulaciones/{postulacion_id}",
        json={"estado": "ACEPTADA"},
        headers=auth(cliente),
    )
    assert aceptada.status_code == 200
    assert aceptada.json()["estado"] == "ACEPTADA"

    # 5. no se puede responder dos veces
    otra_vez = client.patch(
        f"/postulaciones/{postulacion_id}",
        json={"estado": "RECHAZADA"},
        headers=auth(cliente),
    )
    assert otra_vez.status_code == 409

    # 6. otro trabajador se postula y el cliente lo rechaza
    segundo = crear_usuario("TRABAJADOR")
    try:
        segunda = client.post(
            f"/proyectos/{proyecto_id}/postulaciones",
            json={"tarifa_por_hora": 60000},
            headers=auth(segundo, "TRABAJADOR"),
        )
        assert segunda.status_code == 201
        rechazada = client.patch(
            f"/postulaciones/{segunda.json()['id']}",
            json={"estado": "RECHAZADA"},
            headers=auth(cliente),
        )
        assert rechazada.status_code == 200
        assert rechazada.json()["estado"] == "RECHAZADA"
    finally:
        eliminar_usuario(segundo)

    # 7. un cliente no puede postularse como trabajador
    mala_rol = client.post(
        f"/proyectos/{proyecto_id}/postulaciones",
        json={"tarifa_por_hora": 1000},
        headers=auth(cliente, "CLIENTE"),
    )
    assert mala_rol.status_code == 403

    client.delete(f"/proyectos/{proyecto_id}", headers=auth(cliente))


def test_no_se_puede_postular_a_proyecto_no_abierto(client, usuarios):
    cliente = usuarios["cliente"]
    trabajador = usuarios["trabajador"]

    creacion = client.post(
        "/proyectos",
        json=cuerpo_proyecto(nombre_proyecto="Proyecto en curso"),
        headers=auth(cliente),
    )
    proyecto_id = creacion.json()["id"]
    client.patch(f"/proyectos/{proyecto_id}", json={"estado": "EN_CURSO"}, headers=auth(cliente))

    respuesta = client.post(
        f"/proyectos/{proyecto_id}/postulaciones",
        json={"tarifa_por_hora": 10000},
        headers=auth(trabajador, "TRABAJADOR"),
    )
    assert respuesta.status_code == 409
    assert "ABIERTO" in respuesta.json()["message"]

    client.delete(f"/proyectos/{proyecto_id}", headers=auth(cliente))


def test_postulacion_a_proyecto_inexistente(client, usuarios):
    respuesta = client.post(
        "/proyectos/999999/postulaciones",
        json={"tarifa_por_hora": 10000},
        headers=auth(usuarios["trabajador"], "TRABAJADOR"),
    )
    assert respuesta.status_code == 404


# ---------------------------------------------------------------------------
# Errores con formato unico
# ---------------------------------------------------------------------------
def test_formato_de_error_unificado(client, usuarios):
    respuesta = client.get("/proyectos/999999", headers=auth(usuarios["cliente"]))
    assert set(respuesta.json().keys()) == {"status", "message"}

    invalida = client.get("/proyectos?limit=0", headers=auth(usuarios["cliente"]))
    assert invalida.status_code == 422
    assert invalida.json()["status"] == "error"
    assert "errors" in invalida.json()
