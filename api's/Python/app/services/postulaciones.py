import logging

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth import UsuarioToken
from app.errors import ErrorAPI
from app.models import (
    EstadoPostulacion,
    EstadoProyecto,
    Postulacion,
    Trabajador,
    Usuario,
)
from app.schemas import PostulacionCreate, PostulacionRespuesta
from app.services.proyectos import buscar_o_404

logger = logging.getLogger("api_proyectos.postulaciones")


def _exigir_trabajador(db: Session, usuario: UsuarioToken) -> None:
    if db.get(Trabajador, usuario.id) is None:
        if db.get(Usuario, usuario.id) is None:
            raise ErrorAPI(404, "El usuario autenticado no existe")
        raise ErrorAPI(404, "El usuario autenticado no esta registrado como trabajador")


def crear(db: Session, usuario: UsuarioToken, proyecto_id: int, data: PostulacionCreate) -> Postulacion:
    proyecto = buscar_o_404(db, proyecto_id)

    if EstadoProyecto(proyecto.estado) != EstadoProyecto.ABIERTO:
        raise ErrorAPI(
            409,
            f"El proyecto debe estar en estado ABIERTO para postularse "
            f"(estado actual: {EstadoProyecto(proyecto.estado).value})",
        )

    _exigir_trabajador(db, usuario)

    duplicada = (
        db.query(Postulacion)
        .filter(Postulacion.proyecto_id == proyecto_id, Postulacion.usuario_id == usuario.id)
        .first()
    )
    if duplicada is not None:
        raise ErrorAPI(409, "Ya te postulaste a este proyecto")

    try:
        postulacion = Postulacion(
            proyecto_id=proyecto_id,
            usuario_id=usuario.id,
            tarifa_por_hora=data.tarifa_por_hora,
            mensaje=data.mensaje,
        )
        db.add(postulacion)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning(
            "Duplicada o violacion de integridad al postular el usuario %s al proyecto %s: %s",
            usuario.id,
            proyecto_id,
            exc,
        )
        raise ErrorAPI(409, "Ya te postulaste a este proyecto") from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Error de base de datos al postular al proyecto %s", proyecto_id)
        raise ErrorAPI(500, "Error interno al registrar la postulacion") from exc

    db.refresh(postulacion)
    return postulacion


def listar(db: Session, usuario: UsuarioToken, proyecto_id: int) -> list[Postulacion]:
    proyecto = buscar_o_404(db, proyecto_id)
    if proyecto.usuario_id != usuario.id:
        raise ErrorAPI(403, "Solo el cliente propietario del proyecto puede ver sus postulaciones")
    return (
        db.query(Postulacion)
        .filter(Postulacion.proyecto_id == proyecto_id)
        .order_by(Postulacion.id)
        .all()
    )


def responder(
    db: Session, usuario: UsuarioToken, postulacion_id: int, data: PostulacionRespuesta
) -> Postulacion:
    postulacion = db.get(Postulacion, postulacion_id)
    if postulacion is None:
        raise ErrorAPI(404, "Postulacion no encontrada")

    proyecto = buscar_o_404(db, postulacion.proyecto_id)
    if proyecto.usuario_id != usuario.id:
        raise ErrorAPI(403, "Solo el cliente propietario del proyecto puede responder postulaciones")

    if EstadoPostulacion(postulacion.estado) != EstadoPostulacion.PENDIENTE:
        raise ErrorAPI(
            409,
            f"La postulacion ya fue respondida con estado {EstadoPostulacion(postulacion.estado).value}",
        )

    try:
        postulacion.estado = EstadoPostulacion(data.estado)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Error de base de datos al responder la postulacion %s", postulacion_id)
        raise ErrorAPI(500, "Error interno al responder la postulacion") from exc

    db.refresh(postulacion)
    return postulacion
