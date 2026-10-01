from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Proyecto, ProyectoTecnologia, ProyectoDiseno,
    ProyectoRedaccion, ProyectoMarketing, ProyectoAsistencia
)
from app import schemas

router = APIRouter(prefix="/proyectos", tags=["Proyectos"])


def serializar_proyecto(p: Proyecto) -> dict:
    tipo = "General"
    specs = {}

    if p.tecnologia:
        tipo = "TecnologiaYProgramacion"
        specs = {
            "lenguaje_principal": p.tecnologia.lenguaje_principal,
            "repositorio_url": p.tecnologia.repositorio_url
        }
    elif p.diseno:
        tipo = "DisenoYMultimedia"
        specs = {
            "software_utilizado": p.diseno.software_utilizado,
            "formato_entrega": p.diseno.formato_entrega
        }
    elif p.redaccion:
        tipo = "RedaccionYContenido"
        specs = {
            "cantidad_palabras": p.redaccion.cantidad_palabras,
            "idioma": p.redaccion.idioma
        }
    elif p.marketing:
        tipo = "MarketingDigitalYRedesSociales"
        specs = {
            "plataforma_objetivo": p.marketing.plataforma_objetivo,
            "tipo_campana": p.marketing.tipo_campana
        }
    elif p.asistencia:
        tipo = "AsistenciaVirtualYAdministracion"
        specs = {
            "herramientas_manejo": p.asistencia.herramientas_manejo,
            "horas_semanales_requeridas": p.asistencia.horas_semanales_requeridas
        }

    return {
        "id": p.id,
        "usuario_id": p.usuario_id,
        "nombre_proyecto": p.nombre_proyecto,
        "descripcion": p.descripcion,
        "fecha_inicio": p.fecha_inicio,
        "estado": p.estado,
        "tipo_proyecto": tipo,
        "especificaciones": specs
    }

#endposinds de los cruds
@router.post("/", response_model=schemas.ProyectoDetalleResponse, status_code=status.HTTP_201_CREATED)
def crear_proyecto(data: schemas.ProyectoCreate, db: Session = Depends(get_db)):
    nuevo_proyecto = Proyecto(
        usuario_id=data.usuario_id,
        nombre_proyecto=data.nombre_proyecto,
        descripcion=data.descripcion,
        fecha_inicio=data.fecha_inicio,
        estado=data.estado
    )
    db.add(nuevo_proyecto)
    db.flush()

    if data.tecnologia:
        db.add(ProyectoTecnologia(proyecto_id=nuevo_proyecto.id, **data.tecnologia.model_dump()))
    elif data.diseno:
        db.add(ProyectoDiseno(proyecto_id=nuevo_proyecto.id, **data.diseno.model_dump()))
    elif data.redaccion:
        db.add(ProyectoRedaccion(proyecto_id=nuevo_proyecto.id, **data.redaccion.model_dump()))
    elif data.marketing:
        db.add(ProyectoMarketing(proyecto_id=nuevo_proyecto.id, **data.marketing.model_dump()))
    elif data.asistencia:
        db.add(ProyectoAsistencia(proyecto_id=nuevo_proyecto.id, **data.asistencia.model_dump()))

    db.commit()
    db.refresh(nuevo_proyecto)
    return serializar_proyecto(nuevo_proyecto)


@router.get("/", response_model=List[schemas.ProyectoDetalleResponse])
def listar_proyectos(estado: Optional[str] = Query(None), db: Session = Depends(get_db)):
    query = db.query(Proyecto)
    if estado:
        query = query.filter(Proyecto.estado == estado)
    return [serializar_proyecto(p) for p in query.all()]


@router.get("/{proyecto_id}", response_model=schemas.ProyectoDetalleResponse)
def obtener_proyecto(proyecto_id: int, db: Session = Depends(get_db)):
    p = db.query(Proyecto).filter(Proyecto.id == proyecto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return serializar_proyecto(p)


@router.put("/{proyecto_id}", response_model=schemas.ProyectoDetalleResponse)
def actualizar_proyecto(proyecto_id: int, data: schemas.ProyectoUpdate, db: Session = Depends(get_db)):
    p = db.query(Proyecto).filter(Proyecto.id == proyecto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return serializar_proyecto(p)


@router.delete("/{proyecto_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_proyecto(proyecto_id: int, db: Session = Depends(get_db)):
    p = db.query(Proyecto).filter(Proyecto.id == proyecto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    db.delete(p)
    db.commit()
    return None

#metodos del uml
@router.post("/{proyecto_id}/asociar-asignacion", status_code=status.HTTP_201_CREATED)
def asociar_asignacion(proyecto_id: int, datos: schemas.AsociarAsignacionInput, db: Session = Depends(get_db)):
    p = db.query(Proyecto).filter(Proyecto.id == proyecto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    sql = text("""
        INSERT INTO asignaciones (usuario_id, proyecto_id, rol_en_proyecto, tarifa_por_hora)
        VALUES (:usuario_id, :proyecto_id, :rol, :tarifa)
    """)
    db.execute(sql, {
        "usuario_id": datos.usuario_id,
        "proyecto_id": proyecto_id,
        "rol": datos.rol_en_proyecto,
        "tarifa": datos.tarifa_por_hora
    })
    db.commit()
    return {"mensaje": "Asignación vinculada con éxito", "proyecto_id": proyecto_id}


@router.get("/{proyecto_id}/consultar-progreso", response_model=schemas.ProgresoResponse)
def consultar_progreso(proyecto_id: int, db: Session = Depends(get_db)):
    p = db.query(Proyecto).filter(Proyecto.id == proyecto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    dias = (date.today() - p.fecha_inicio).days
    info = serializar_proyecto(p)
    return schemas.ProgresoResponse(
        proyecto_id=p.id,
        nombre_proyecto=p.nombre_proyecto,
        estado=p.estado,
        fecha_inicio=p.fecha_inicio,
        dias_activo=max(0, dias),
        tipo_proyecto=info["tipo_proyecto"],
        detalles_especialidad=info["especificaciones"]
    )