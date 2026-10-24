from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Annotated, List, Literal, Optional, Union

from pydantic import (
    AliasChoices,
    AnyHttpUrl,
    BaseModel,
    ConfigDict,
    Field,
    TypeAdapter,
    ValidationError,
    field_validator,
    model_validator,
)

from app.models import (
    BLOQUE_POR_TIPO,
    ESTADO_PROYECTO_INICIAL,
    EstadoPostulacion,
    EstadoProyecto,
    TipoProyecto,
)

MAX_NOMBRE = 150
LIMITE_INFERIOR_FECHA = date(2000, 1, 1)
HORAS_SEMANALES_MAX = 168


# Bloque de entrada

_VALIDADOR_URL = TypeAdapter(AnyHttpUrl)


class TecnologiaInput(BaseModel):
    lenguaje_principal: str = Field(..., min_length=1, max_length=100)
    repositorio_url: Optional[str] = Field(default=None, max_length=255)

    @field_validator("repositorio_url")
    @classmethod
    def repositorio_url_valida(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None or not valor.strip():
            return None
        valor = valor.strip()
        try:
            _VALIDADOR_URL.validate_python(valor)
        except ValidationError as exc:
            raise ValueError("Url") from exc
        return valor


class DisenoInput(BaseModel):
    software_utilizado: str = Field(..., min_length=1, max_length=100)
    formato_entrega: str = Field(..., min_length=1, max_length=50)


class RedaccionInput(BaseModel):
    cantidad_palabras: int = Field(..., gt=0, description="Debe ser mayor que 0")
    idioma: str = Field(..., min_length=1, max_length=50)


class MarketingInput(BaseModel):
    plataforma_objetivo: str = Field(..., min_length=1, max_length=100)
    tipo_campana: str = Field(..., min_length=1, max_length=100)


class AsistenciaInput(BaseModel):
    herramientas_manejo: str = Field(..., min_length=1, max_length=255)
    horas_semanales_requeridas: int = Field(
        ..., ge=1, le=HORAS_SEMANALES_MAX, description="Entre 1 y 168 horas"
    )


# Bloque de salida

class TecnologiaEspecificacion(BaseModel):
    lenguaje_principal: str
    repositorio_url: Optional[str] = None


class DisenoEspecificacion(BaseModel):
    software_utilizado: str
    formato_entrega: str


class RedaccionEspecificacion(BaseModel):
    cantidad_palabras: int
    idioma: str


class MarketingEspecificacion(BaseModel):
    plataforma_objetivo: str
    tipo_campana: str


class AsistenciaEspecificacion(BaseModel):
    herramientas_manejo: str
    horas_semanales_requeridas: int


class GeneralEspecificacion(BaseModel):
    """Proyecto sin bloque de categoria asociado."""


EspecificacionesProyecto = Union[
    TecnologiaEspecificacion,
    DisenoEspecificacion,
    RedaccionEspecificacion,
    MarketingEspecificacion,
    AsistenciaEspecificacion,
    GeneralEspecificacion,
]

_CLAVES_CATEGORIA = tuple(BLOQUE_POR_TIPO[t] for t in TipoProyecto)


# Proyecto Crea / Actualiza

class ProyectoCreate(BaseModel):
    cliente_id: int = Field(
        ...,
        ge=1,
        validation_alias=AliasChoices("cliente_id", "usuario_id"),
        description="ID del cliente propietario del proyecto",
    )
    nombre_proyecto: str = Field(..., min_length=1, max_length=MAX_NOMBRE)
    descripcion: Optional[str] = None
    fecha_inicio: date
    estado: EstadoProyecto = ESTADO_PROYECTO_INICIAL

    tecnologia: Optional[TecnologiaInput] = None
    diseno: Optional[DisenoInput] = None
    redaccion: Optional[RedaccionInput] = None
    marketing: Optional[MarketingInput] = None
    asistencia: Optional[AsistenciaInput] = None

    @field_validator("nombre_proyecto")
    @classmethod
    def nombre_no_vacio(cls, valor: str) -> str:
        valor = valor.strip()
        if not valor:
            raise ValueError("nombre_proyecto no puede estar vacio")
        if len(valor) > MAX_NOMBRE:
            raise ValueError(f"nombre_proyecto supera los {MAX_NOMBRE} caracteres")
        return valor

    @field_validator("fecha_inicio")
    @classmethod
    def fecha_razonable(cls, valor: date) -> date:
        if valor < LIMITE_INFERIOR_FECHA:
            raise ValueError("fecha_inicio no puede ser anterior al 2000-01-01")
        if valor > date.today() + timedelta(days=365 * 5):
            raise ValueError("fecha_inicio no puede ser mas de 5 anos en el futuro")
        return valor

    @model_validator(mode="after")
    def exactamente_una_categoria(self):
        presentes = [clave for clave in _CLAVES_CATEGORIA if getattr(self, clave) is not None]
        if len(presentes) != 1:
            raise ValueError(
                "Debe indicar exactamente una categoria entre: "
                + ", ".join(_CLAVES_CATEGORIA)
                + f" (recibidas: {len(presentes)})"
            )
        return self

    def tipo_y_bloque(self):
        for tipo, clave in BLOQUE_POR_TIPO.items():
            if getattr(self, clave) is not None:
                return tipo, clave
        return None, None


class ProyectoUpdate(BaseModel):
    """PUT: reemplazo completo. Debe traer todos los campos."""

    nombre_proyecto: str = Field(..., min_length=1, max_length=MAX_NOMBRE)
    descripcion: Optional[str] = None
    estado: EstadoProyecto

    @field_validator("nombre_proyecto")
    @classmethod
    def nombre_no_vacio(cls, valor: str) -> str:
        valor = valor.strip()
        if not valor:
            raise ValueError("nombre_proyecto no puede estar vacio")
        return valor


class ProyectoPatch(BaseModel):
    """PATCH: cambios parciales. nombre_proyecto no puede llegar como null."""

    nombre_proyecto: Optional[str] = Field(default=None, max_length=MAX_NOMBRE)
    descripcion: Optional[str] = None
    estado: Optional[EstadoProyecto] = None

    @field_validator("nombre_proyecto", mode="after")
    @classmethod
    def nombre_no_nulo(cls, valor: Optional[str]) -> str:
        if valor is None:
            raise ValueError("nombre_proyecto no puede ser null")
        valor = valor.strip()
        if not valor:
            raise ValueError("nombre_proyecto no puede estar vacio")
        return valor


# Respuestas

class _ProyectoBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cliente_id: int
    nombre_proyecto: str
    descripcion: Optional[str] = None
    fecha_inicio: date
    tipo: TipoProyecto
    estado: EstadoProyecto


class ProyectoTecnologiaResponse(_ProyectoBase):
    tipo_proyecto: Literal["TECNOLOGIA"]
    especificaciones: TecnologiaEspecificacion


class ProyectoDisenoResponse(_ProyectoBase):
    tipo_proyecto: Literal["DISENO"]
    especificaciones: DisenoEspecificacion


class ProyectoRedaccionResponse(_ProyectoBase):
    tipo_proyecto: Literal["REDACCION"]
    especificaciones: RedaccionEspecificacion


class ProyectoMarketingResponse(_ProyectoBase):
    tipo_proyecto: Literal["MARKETING"]
    especificaciones: MarketingEspecificacion


class ProyectoAsistenciaResponse(_ProyectoBase):
    tipo_proyecto: Literal["ASISTENCIA"]
    especificaciones: AsistenciaEspecificacion


class ProyectoGeneralResponse(_ProyectoBase):
    tipo_proyecto: Literal["GENERAL"]
    especificaciones: GeneralEspecificacion


ProyectoDetalleResponse = Annotated[
    Union[
        ProyectoTecnologiaResponse,
        ProyectoDisenoResponse,
        ProyectoRedaccionResponse,
        ProyectoMarketingResponse,
        ProyectoAsistenciaResponse,
        ProyectoGeneralResponse,
    ],
    Field(discriminator="tipo_proyecto"),
]


class ProyectoListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[ProyectoDetalleResponse]


class ProgresoResponse(BaseModel):
    proyecto_id: int
    nombre_proyecto: str
    estado: EstadoProyecto
    fecha_inicio: date
    dias_activo: int
    horas_aprobadas: Decimal
    horas_pendientes: Decimal
    horas_congeladas: Decimal
    numero_asignaciones: int
    costo_acumulado: Decimal
    tipo_proyecto: Literal[
        "TECNOLOGIA",
        "DISENO",
        "REDACCION",
        "MARKETING",
        "ASISTENCIA",
        "GENERAL",
    ]
    detalles_especialidad: EspecificacionesProyecto


class AsignacionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    proyecto_id: int
    trabajador_id: int
    rol_en_proyecto: str
    tarifa_por_hora: Decimal
    temporizador_inicio: Optional[datetime] = None


# --------------------------------------------------------------------------
# Postulaciones
# --------------------------------------------------------------------------
class PostulacionCreate(BaseModel):
    trabajador_id: int = Field(
        ...,
        ge=1,
        validation_alias=AliasChoices("trabajador_id", "usuario_id"),
        description="ID del trabajador que se postula",
    )
    tarifa_propuesta: Decimal = Field(
        ...,
        gt=0,
        max_digits=10,
        decimal_places=2,
        validation_alias=AliasChoices("tarifa_propuesta", "tarifa_por_hora"),
    )
    mensaje: Optional[str] = Field(default=None, max_length=1000)


class PostulacionRespuesta(BaseModel):
    estado: Literal["ACEPTADA", "RECHAZADA"]


class PostulacionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    proyecto_id: int
    trabajador_id: int
    tarifa_propuesta: Decimal
    mensaje: Optional[str] = None
    estado: EstadoPostulacion
    fecha_postulacion: datetime
