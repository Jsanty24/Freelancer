from pydantic import BaseModel
from typing import Optional
from datetime import date
from decimal import Decimal


class TecnologiaSchema(BaseModel):
    lenguaje_principal: str
    repositorio_url: Optional[str] = None

class DisenoSchema(BaseModel):
    software_utilizado: str
    formato_entrega: str

class RedaccionSchema(BaseModel):
    cantidad_palabras: int
    idioma: str

class MarketingSchema(BaseModel):
    plataforma_objetivo: str
    tipo_campana: str

class AsistenciaSchema(BaseModel):
    herramientas_manejo: str
    horas_semanales_requeridas: int


class ProyectoCreate(BaseModel):
    usuario_id: int
    nombre_proyecto: str
    descripcion: Optional[str] = None
    fecha_inicio: date
    estado: str = "En Curso"

    tecnologia: Optional[TecnologiaSchema] = None
    diseno: Optional[DisenoSchema] = None
    redaccion: Optional[RedaccionSchema] = None
    marketing: Optional[MarketingSchema] = None
    asistencia: Optional[AsistenciaSchema] = None


class ProyectoUpdate(BaseModel):
    nombre_proyecto: Optional[str] = None
    descripcion: Optional[str] = None
    estado: Optional[str] = None


class ProyectoDetalleResponse(BaseModel):
    id: int
    usuario_id: int
    nombre_proyecto: str
    descripcion: Optional[str]
    fecha_inicio: date
    estado: str
    tipo_proyecto: str
    especificaciones: dict

    class Config:
        from_attributes = True


class AsociarAsignacionInput(BaseModel):
    usuario_id: int
    rol_en_proyecto: str
    tarifa_por_hora: Decimal


class ProgresoResponse(BaseModel):
    proyecto_id: int
    nombre_proyecto: str
    estado: str
    fecha_inicio: date
    dias_activo: int
    tipo_proyecto: str
    detalles_especialidad: dict