from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app import schemas
from app.auth import UsuarioAutenticado, UsuarioCliente
from app.database import get_db
from app.errors import RESPUESTAS_AUTH, RESPUESTAS_RECURSO, respuesta_error
from app.models import CategoriaProyecto, EstadoProyecto
from app.services import proyectos as servicio

router = APIRouter(prefix="/proyectos", tags=["Proyectos"])

RESPUESTAS_CREAR = {
    **RESPUESTAS_AUTH,
    404: respuesta_error(
        404, "No encontrado", "El usuario autenticado no existe o no esta registrado como cliente"
    ),
    409: respuesta_error(409, "Conflicto", "Violacion de integridad de datos al crear el proyecto"),
    422: respuesta_error(
        422,
        "Validacion",
        "Cuerpo invalido: exactamente una categoria, nombre de 1 a 150 caracteres, fechas razonables, etc.",
    ),
}

RESPUESTAS_MODIFICAR = {
    **RESPUESTAS_RECURSO,
    409: respuesta_error(
        409, "Conflicto", "Cambio de estado no permitido o proyecto con asignaciones"
    ),
    422: respuesta_error(422, "Validacion", "Cuerpo invalido: tipos o valores no admitidos"),
}

RESPUESTAS_ELIMINAR = {
    **RESPUESTAS_RECURSO,
    409: respuesta_error(
        409,
        "Conflicto",
        "El proyecto tiene asignaciones asociadas; no puede eliminarse. Cambia su estado a CANCELADO.",
    ),
}


@router.post(
    "",
    response_model=schemas.ProyectoDetalleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear proyecto",
    responses=RESPUESTAS_CREAR,
)
def crear_proyecto(
    data: schemas.ProyectoCreate,
    usuario: UsuarioCliente,
    db: Session = Depends(get_db),
):
    """Registra un proyecto del cliente autenticado (usuario_id se toma del token).

    Debe traer exactamente una categoria: `tecnologia`, `diseno`, `redaccion`,
    `marketing` o `asistencia`.
    """
    return servicio.crear(db, usuario, data)


@router.get(
    "",
    response_model=schemas.ProyectoListResponse,
    summary="Listar proyectos",
    responses={
        **RESPUESTAS_AUTH,
        422: respuesta_error(422, "Validacion", "limit, offset, estado o categoria invalidos"),
    },
)
def listar_proyectos(
    usuario: UsuarioAutenticado,
    db: Session = Depends(get_db),
    estado: Optional[EstadoProyecto] = Query(None, description="Filtra por estado del proyecto"),
    cliente: Optional[int] = Query(None, ge=1, description="Filtra por cliente propietario (usuario_id)"),
    categoria: Optional[CategoriaProyecto] = Query(None, description="Filtra por categoria"),
    limit: int = Query(50, ge=1, le=100, description="Maximo de proyectos por pagina"),
    offset: int = Query(0, ge=0, description="Desplazamiento para paginar"),
):
    """Lista los proyectos con paginacion (limit/offset) y filtros por estado, cliente y categoria."""
    return servicio.listar(
        db, estado=estado, cliente=cliente, categoria=categoria, limit=limit, offset=offset
    )


@router.get(
    "/{proyecto_id}",
    response_model=schemas.ProyectoDetalleResponse,
    summary="Obtener un proyecto",
    responses=RESPUESTAS_RECURSO,
)
def obtener_proyecto(
    proyecto_id: int,
    usuario: UsuarioAutenticado,
    db: Session = Depends(get_db),
):
    """Devuelve un proyecto por su identificador."""
    return servicio.obtener(db, proyecto_id)


@router.put(
    "/{proyecto_id}",
    response_model=schemas.ProyectoDetalleResponse,
    summary="Reemplazar un proyecto (PUT completo)",
    responses=RESPUESTAS_MODIFICAR,
)
def reemplazar_proyecto(
    proyecto_id: int,
    data: schemas.ProyectoUpdate,
    usuario: UsuarioCliente,
    db: Session = Depends(get_db),
):
    """Reemplaza el proyecto completo: nombre_proyecto, descripcion y estado son obligatorios.

    Solo el cliente propietario puede hacerlo. `fecha_inicio` no es modificable.
    """
    return servicio.actualizar(db, proyecto_id, usuario, data, parcial=False)


@router.patch(
    "/{proyecto_id}",
    response_model=schemas.ProyectoDetalleResponse,
    summary="Actualizar parcialmente un proyecto (PATCH)",
    responses=RESPUESTAS_MODIFICAR,
)
def actualizar_parcial_proyecto(
    proyecto_id: int,
    data: schemas.ProyectoPatch,
    usuario: UsuarioCliente,
    db: Session = Depends(get_db),
):
    """Actualiza solo los campos enviados. `nombre_proyecto` no admite null.

    Solo el cliente propietario puede hacerlo y el cambio de estado debe estar permitido.
    """
    return servicio.actualizar(db, proyecto_id, usuario, data, parcial=True)


@router.delete(
    "/{proyecto_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar un proyecto",
    responses=RESPUESTAS_ELIMINAR,
)
def eliminar_proyecto(
    proyecto_id: int,
    usuario: UsuarioCliente,
    db: Session = Depends(get_db),
):
    """Elimina el proyecto si no tiene asignaciones; si las tiene responde 409."""
    servicio.eliminar(db, proyecto_id, usuario)
    return None


@router.get(
    "/{proyecto_id}/asignaciones",
    response_model=list[schemas.AsignacionResponse],
    summary="Listar asignaciones del proyecto (solo lectura)",
    responses=RESPUESTAS_RECURSO,
)
def listar_asignaciones(
    proyecto_id: int,
    usuario: UsuarioAutenticado,
    db: Session = Depends(get_db),
):
    """Devuelve las asignaciones del proyecto. La tabla la gestiona la API Node; aqui solo se lee."""
    return servicio.asignaciones(db, proyecto_id)


@router.get(
    "/{proyecto_id}/progreso",
    response_model=schemas.ProgresoResponse,
    summary="Consultar el progreso del proyecto",
    responses=RESPUESTAS_RECURSO,
)
def consultar_progreso(
    proyecto_id: int,
    usuario: UsuarioAutenticado,
    db: Session = Depends(get_db),
):
    """Dias activos, horas aprobadas y pendientes, asignaciones y costo acumulado."""
    return servicio.progreso(db, proyecto_id)
