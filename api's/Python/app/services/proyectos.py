import logging
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import case, func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.auth import UsuarioToken
from app.errors import ErrorAPI
from app.models import (
    Asignacion,
    Cliente,
    EstadoProyecto,
    EstadoTiempo,
    Proyecto,
    ProyectoAsistencia,
    ProyectoDiseno,
    ProyectoMarketing,
    ProyectoRedaccion,
    ProyectoTecnologia,
    RegistroTiempo,
    TRANSICIONES_ESTADO_PROYECTO,
    Usuario,
)
from app.schemas import ProyectoCreate, ProyectoPatch, ProyectoUpdate

logger = logging.getLogger("api_proyectos.proyectos")

_CARGA_CATEGORIAS = (
    selectinload(Proyecto.tecnologia),
    selectinload(Proyecto.diseno),
    selectinload(Proyecto.redaccion),
    selectinload(Proyecto.marketing),
    selectinload(Proyecto.asistencia),
)

_MODELOS_DETALLE = {
    "tecnologia": ProyectoTecnologia,
    "diseno": ProyectoDiseno,
    "redaccion": ProyectoRedaccion,
    "marketing": ProyectoMarketing,
    "asistencia": ProyectoAsistencia,
}


def _categoria_y_specs(proyecto: Proyecto):
    if proyecto.tecnologia:
        return (
            "TecnologiaYProgramacion",
            {
                "lenguaje_principal": proyecto.tecnologia.lenguaje_principal,
                "repositorio_url": proyecto.tecnologia.repositorio_url,
            },
        )
    if proyecto.diseno:
        return (
            "DisenoYMultimedia",
            {
                "software_utilizado": proyecto.diseno.software_utilizado,
                "formato_entrega": proyecto.diseno.formato_entrega,
            },
        )
    if proyecto.redaccion:
        return (
            "RedaccionYContenido",
            {
                "cantidad_palabras": proyecto.redaccion.cantidad_palabras,
                "idioma": proyecto.redaccion.idioma,
            },
        )
    if proyecto.marketing:
        return (
            "MarketingDigitalYRedesSociales",
            {
                "plataforma_objetivo": proyecto.marketing.plataforma_objetivo,
                "tipo_campana": proyecto.marketing.tipo_campana,
            },
        )
    if proyecto.asistencia:
        return (
            "AsistenciaVirtualYAdministracion",
            {
                "herramientas_manejo": proyecto.asistencia.herramientas_manejo,
                "horas_semanales_requeridas": proyecto.asistencia.horas_semanales_requeridas,
            },
        )
    return "General", {}


def serializar(proyecto: Proyecto) -> dict:
    tipo_proyecto, especificaciones = _categoria_y_specs(proyecto)
    return {
        "id": proyecto.id,
        "usuario_id": proyecto.usuario_id,
        "nombre_proyecto": proyecto.nombre_proyecto,
        "descripcion": proyecto.descripcion,
        "fecha_inicio": proyecto.fecha_inicio,
        "estado": proyecto.estado,
        "categoria": proyecto.categoria,
        "tipo_proyecto": tipo_proyecto,
        "especificaciones": especificaciones,
    }


def buscar_o_404(db: Session, proyecto_id: int) -> Proyecto:
    proyecto = (
        db.query(Proyecto).options(*_CARGA_CATEGORIAS).filter(Proyecto.id == proyecto_id).first()
    )
    if proyecto is None:
        raise ErrorAPI(404, "Proyecto no encontrado")
    return proyecto


def _exigir_propietario(proyecto: Proyecto, usuario: UsuarioToken) -> None:
    if proyecto.usuario_id != usuario.id:
        raise ErrorAPI(403, "No eres el cliente propietario de este proyecto")


def _exigir_cliente(db: Session, usuario: UsuarioToken) -> None:
    if db.get(Cliente, usuario.id) is None:
        if db.get(Usuario, usuario.id) is None:
            raise ErrorAPI(404, "El usuario autenticado no existe")
        raise ErrorAPI(404, "El usuario autenticado no esta registrado como cliente")


def _exigir_transicion(actual, nuevo) -> None:
    estado_actual = EstadoProyecto(actual)
    estado_nuevo = EstadoProyecto(nuevo)
    if estado_actual == estado_nuevo:
        return
    permitidos = TRANSICIONES_ESTADO_PROYECTO.get(estado_actual, set())
    if estado_nuevo not in permitidos:
        permitidos_txt = ", ".join(sorted(e.value for e in permitidos)) or "ninguno"
        raise ErrorAPI(
            409,
            f"Cambio de estado no permitido: {estado_actual.value} -> {estado_nuevo.value}. "
            f"Desde {estado_actual.value} solo se permite: {permitidos_txt}",
        )


def crear(db: Session, usuario: UsuarioToken, data: ProyectoCreate) -> dict:
    _exigir_cliente(db, usuario)
    categoria, bloque = data.categoria_y_bloque()

    try:
        proyecto = Proyecto(
            usuario_id=usuario.id,
            nombre_proyecto=data.nombre_proyecto,
            descripcion=data.descripcion,
            fecha_inicio=data.fecha_inicio,
            estado=data.estado,
            categoria=categoria,
        )
        db.add(proyecto)
        db.flush()

        detalle = getattr(data, bloque)
        modelo_detalle = _MODELOS_DETALLE[bloque]
        db.add(modelo_detalle(proyecto_id=proyecto.id, **detalle.model_dump()))
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("Violacion de integridad al crear proyecto del usuario %s: %s", usuario.id, exc)
        raise ErrorAPI(409, "No se pudo crear el proyecto por una violacion de integridad de datos") from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Error de base de datos al crear proyecto del usuario %s", usuario.id)
        raise ErrorAPI(500, "Error interno al crear el proyecto") from exc

    db.refresh(proyecto)
    return serializar(proyecto)


def listar(
    db: Session,
    *,
    estado: Optional[EstadoProyecto] = None,
    cliente: Optional[int] = None,
    categoria=None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    consulta = db.query(Proyecto).options(*_CARGA_CATEGORIAS)
    if estado is not None:
        consulta = consulta.filter(Proyecto.estado == estado)
    if cliente is not None:
        consulta = consulta.filter(Proyecto.usuario_id == cliente)
    if categoria is not None:
        consulta = consulta.filter(Proyecto.categoria == categoria)

    total = consulta.count()
    proyectos = consulta.order_by(Proyecto.id.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [serializar(p) for p in proyectos],
    }


def obtener(db: Session, proyecto_id: int) -> dict:
    return serializar(buscar_o_404(db, proyecto_id))


def actualizar(
    db: Session,
    proyecto_id: int,
    usuario: UsuarioToken,
    data: ProyectoUpdate | ProyectoPatch,
    *,
    parcial: bool,
) -> dict:
    proyecto = buscar_o_404(db, proyecto_id)
    _exigir_propietario(proyecto, usuario)

    campos = data.model_dump(exclude_unset=True) if parcial else data.model_dump()
    if "estado" in campos:
        _exigir_transicion(proyecto.estado, campos["estado"])

    try:
        for nombre, valor in campos.items():
            setattr(proyecto, nombre, valor)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("Violacion de integridad al actualizar el proyecto %s: %s", proyecto_id, exc)
        raise ErrorAPI(409, "No se pudo actualizar el proyecto por una violacion de integridad") from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Error de base de datos al actualizar el proyecto %s", proyecto_id)
        raise ErrorAPI(500, "Error interno al actualizar el proyecto") from exc

    db.refresh(proyecto)
    return serializar(proyecto)


def eliminar(db: Session, proyecto_id: int, usuario: UsuarioToken) -> None:
    proyecto = buscar_o_404(db, proyecto_id)
    _exigir_propietario(proyecto, usuario)

    total_asignaciones = (
        db.query(func.count(Asignacion.id)).filter(Asignacion.proyecto_id == proyecto.id).scalar()
        or 0
    )
    if total_asignaciones:
        raise ErrorAPI(
            409,
            f"El proyecto tiene {total_asignaciones} asignacion(es) asociadas y no puede eliminarse. "
            "Cambia su estado a CANCELADO o elimina primero las asignaciones.",
        )

    try:
        db.delete(proyecto)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("Integridad referencial al eliminar el proyecto %s: %s", proyecto_id, exc)
        raise ErrorAPI(
            409,
            "El proyecto tiene asignaciones u otros datos relacionados y no puede eliminarse. "
            "Cambia su estado a CANCELADO.",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Error de base de datos al eliminar el proyecto %s", proyecto_id)
        raise ErrorAPI(500, "Error interno al eliminar el proyecto") from exc


def asignaciones(db: Session, proyecto_id: int) -> list[Asignacion]:
    buscar_o_404(db, proyecto_id)
    return (
        db.query(Asignacion)
        .filter(Asignacion.proyecto_id == proyecto_id)
        .order_by(Asignacion.id)
        .all()
    )


def progreso(db: Session, proyecto_id: int) -> dict:
    proyecto = buscar_o_404(db, proyecto_id)

    horas_aprobadas, horas_pendientes, costo = (
        db.query(
            func.coalesce(
                func.sum(
                    case((RegistroTiempo.estado == EstadoTiempo.APROBADO, RegistroTiempo.horas), else_=0)
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case((RegistroTiempo.estado == EstadoTiempo.PENDIENTE, RegistroTiempo.horas), else_=0)
                ),
                0,
            ),
            func.coalesce(func.sum(RegistroTiempo.horas * Asignacion.tarifa_por_hora), 0),
        )
        .select_from(RegistroTiempo)
        .join(Asignacion, RegistroTiempo.asignacion_id == Asignacion.id)
        .filter(Asignacion.proyecto_id == proyecto.id)
        .one()
    )

    total_asignaciones = (
        db.query(func.count(Asignacion.id)).filter(Asignacion.proyecto_id == proyecto.id).scalar()
        or 0
    )
    dias = (date.today() - proyecto.fecha_inicio).days
    tipo_proyecto, especificaciones = _categoria_y_specs(proyecto)

    return {
        "proyecto_id": proyecto.id,
        "nombre_proyecto": proyecto.nombre_proyecto,
        "estado": proyecto.estado,
        "fecha_inicio": proyecto.fecha_inicio,
        "dias_activo": max(0, dias),
        "horas_aprobadas": Decimal(horas_aprobadas).quantize(Decimal("0.01")),
        "horas_pendientes": Decimal(horas_pendientes).quantize(Decimal("0.01")),
        "numero_asignaciones": int(total_asignaciones),
        "costo_acumulado": Decimal(costo).quantize(Decimal("0.01")),
        "tipo_proyecto": tipo_proyecto,
        "detalles_especialidad": especificaciones,
    }
