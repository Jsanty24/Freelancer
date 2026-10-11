from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import schemas
from app.auth import UsuarioCliente, UsuarioTrabajador
from app.database import get_db
from app.errors import RESPUESTAS_AUTH, RESPUESTAS_RECURSO, respuesta_error
from app.services import postulaciones as servicio

router = APIRouter(tags=["Postulaciones"])

RESPUESTAS_POSTULAR = {
    **RESPUESTAS_AUTH,
    404: respuesta_error(
        404, "No encontrado", "Proyecto inexistente o usuario no registrado como trabajador"
    ),
    409: respuesta_error(
        409,
        "Conflicto",
        "El proyecto no esta ABIERTO o el trabajador ya se postulo a este proyecto",
    ),
    422: respuesta_error(422, "Validacion", "tarifa_por_hora debe ser un numero mayor que 0"),
}

RESPUESTAS_RESPONDER = {
    **RESPUESTAS_RECURSO,
    409: respuesta_error(409, "Conflicto", "La postulacion ya habia sido aceptada o rechazada"),
    422: respuesta_error(422, "Validacion", "estado debe ser ACEPTADA o RECHAZADA"),
}


@router.post(
    "/proyectos/{proyecto_id}/postulaciones",
    response_model=schemas.PostulacionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Postularse a un proyecto",
    responses=RESPUESTAS_POSTULAR,
)
def crear_postulacion(
    proyecto_id: int,
    data: schemas.PostulacionCreate,
    usuario: UsuarioTrabajador,
    db: Session = Depends(get_db),
):
    """El trabajador autenticado se postula al proyecto con una tarifa propuesta.

    Solo se puede postular a proyectos en estado ABIERTO y una sola vez por proyecto.
    """
    return servicio.crear(db, usuario, proyecto_id, data)


@router.get(
    "/proyectos/{proyecto_id}/postulaciones",
    response_model=list[schemas.PostulacionResponse],
    summary="Listar postulaciones de un proyecto",
    responses=RESPUESTAS_RECURSO,
)
def listar_postulaciones(
    proyecto_id: int,
    usuario: UsuarioCliente,
    db: Session = Depends(get_db),
):
    """Devuelve las postulaciones recibidas por el proyecto. Solo su cliente propietario."""
    return servicio.listar(db, usuario, proyecto_id)


@router.patch(
    "/postulaciones/{postulacion_id}",
    response_model=schemas.PostulacionResponse,
    summary="Aceptar o rechazar una postulacion",
    responses=RESPUESTAS_RESPONDER,
)
def responder_postulacion(
    postulacion_id: int,
    data: schemas.PostulacionRespuesta,
    usuario: UsuarioCliente,
    db: Session = Depends(get_db),
):
    """El cliente dueño del proyecto acepta o rechaza una postulacion pendiente."""
    return servicio.responder(db, usuario, postulacion_id, data)
