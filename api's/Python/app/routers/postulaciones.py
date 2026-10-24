from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.errors import RESPUESTAS_RECURSO, respuesta_error
from app.services import postulaciones as servicio

router = APIRouter(tags=["Postulaciones"])

RESPUESTAS_POSTULAR = {
    404: respuesta_error(
        404, "No encontrado", "Proyecto inexistente o usuario no registrado como trabajador"
    ),
    409: respuesta_error(
        409,
        "Conflicto",
        "El proyecto no esta ABIERTO o el trabajador ya se postulo a este proyecto",
    ),
    422: respuesta_error(
        422, "Validacion", "trabajador_id y tarifa_propuesta deben ser numeros mayores que 0"
    ),
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
    db: Session = Depends(get_db),
):
    """El trabajador (`trabajador_id` en el body) se postula al proyecto con una tarifa propuesta.

    Solo se puede postular a proyectos en estado ABIERTO y una sola vez por proyecto.
    """
    return servicio.crear(db, proyecto_id, data)


@router.get(
    "/proyectos/{proyecto_id}/postulaciones",
    response_model=list[schemas.PostulacionResponse],
    summary="Listar postulaciones de un proyecto",
    responses=RESPUESTAS_RECURSO,
)
def listar_postulaciones(
    proyecto_id: int,
    db: Session = Depends(get_db),
):
    """Devuelve las postulaciones recibidas por el proyecto."""
    return servicio.listar(db, proyecto_id)


@router.patch(
    "/postulaciones/{postulacion_id}",
    response_model=schemas.PostulacionResponse,
    summary="Aceptar o rechazar una postulacion",
    responses=RESPUESTAS_RESPONDER,
)
def responder_postulacion(
    postulacion_id: int,
    data: schemas.PostulacionRespuesta,
    db: Session = Depends(get_db),
):
    """Acepta o rechaza una postulacion pendiente."""
    return servicio.responder(db, postulacion_id, data)
