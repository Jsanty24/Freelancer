import enum
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class EstadoProyecto(str, enum.Enum):
    ABIERTO = "ABIERTO"
    EN_CURSO = "EN_CURSO"
    PAUSADO = "PAUSADO"
    COMPLETADO = "COMPLETADO"
    CANCELADO = "CANCELADO"


# D04: el valor por defecto se define unicamente aqui y lo comparten modelo, schemas y base de datos.
ESTADO_PROYECTO_INICIAL = EstadoProyecto.ABIERTO

# Transiciones permitidas. COMPLETADO es terminal: no puede volver a ABIERTO.
TRANSICIONES_ESTADO_PROYECTO = {
    EstadoProyecto.ABIERTO: {EstadoProyecto.EN_CURSO, EstadoProyecto.PAUSADO, EstadoProyecto.CANCELADO},
    EstadoProyecto.EN_CURSO: {EstadoProyecto.PAUSADO, EstadoProyecto.COMPLETADO, EstadoProyecto.CANCELADO},
    EstadoProyecto.PAUSADO: {EstadoProyecto.EN_CURSO, EstadoProyecto.CANCELADO},
    EstadoProyecto.COMPLETADO: set(),
    EstadoProyecto.CANCELADO: {EstadoProyecto.ABIERTO},
}


class CategoriaProyecto(str, enum.Enum):
    TecnologiaYProgramacion = "TecnologiaYProgramacion"
    DisenoYMultimedia = "DisenoYMultimedia"
    RedaccionYContenido = "RedaccionYContenido"
    MarketingDigitalYRedesSociales = "MarketingDigitalYRedesSociales"
    AsistenciaVirtualYAdministracion = "AsistenciaVirtualYAdministracion"


class EstadoPostulacion(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    ACEPTADA = "ACEPTADA"
    RECHAZADA = "RECHAZADA"


class EstadoTiempo(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    APROBADO = "APROBADO"
    CONGELADO = "CONGELADO"


class OrigenRegistro(str, enum.Enum):
    TEMPORIZADOR = "TEMPORIZADOR"
    MANUAL = "MANUAL"


# Clave del bloque de detalle (y del campo del body) asociado a cada categoria.
BLOQUE_POR_CATEGORIA = {
    CategoriaProyecto.TecnologiaYProgramacion: "tecnologia",
    CategoriaProyecto.DisenoYMultimedia: "diseno",
    CategoriaProyecto.RedaccionYContenido: "redaccion",
    CategoriaProyecto.MarketingDigitalYRedesSociales: "marketing",
    CategoriaProyecto.AsistenciaVirtualYAdministracion: "asistencia",
}


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(150), nullable=False)
    email = Column(String(150), nullable=False, unique=True)
    telefono = Column(String(20), nullable=True)


class Cliente(Base):
    __tablename__ = "clientes"

    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    razon_social = Column(String(150), nullable=False)
    direccion_facturacion = Column(String(255), nullable=False)

    usuario = relationship("Usuario")


class Trabajador(Base):
    __tablename__ = "trabajadores"

    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    especialidad = Column(String(100), nullable=False)
    disponibilidad = Column(Boolean, nullable=False, default=True)

    usuario = relationship("Usuario")


class Proyecto(Base):
    __tablename__ = "proyectos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = Column(Integer, ForeignKey("clientes.usuario_id"), nullable=False, index=True)
    nombre_proyecto = Column(String(150), nullable=False)
    descripcion = Column(Text, nullable=True)
    fecha_inicio = Column(Date, nullable=False, default=date.today)
    estado = Column(SAEnum(EstadoProyecto, name="estado_proyecto"), nullable=False, default=ESTADO_PROYECTO_INICIAL)
    categoria = Column(SAEnum(CategoriaProyecto, name="categoria_proyecto"), nullable=True)

    tecnologia = relationship(
        "ProyectoTecnologia", back_populates="proyecto", uselist=False, cascade="all, delete-orphan"
    )
    diseno = relationship(
        "ProyectoDiseno", back_populates="proyecto", uselist=False, cascade="all, delete-orphan"
    )
    redaccion = relationship(
        "ProyectoRedaccion", back_populates="proyecto", uselist=False, cascade="all, delete-orphan"
    )
    marketing = relationship(
        "ProyectoMarketing", back_populates="proyecto", uselist=False, cascade="all, delete-orphan"
    )
    asistencia = relationship(
        "ProyectoAsistencia", back_populates="proyecto", uselist=False, cascade="all, delete-orphan"
    )

    asignaciones = relationship("Asignacion", back_populates="proyecto")
    postulaciones = relationship(
        "Postulacion", back_populates="proyecto", cascade="all, delete-orphan", passive_deletes=True
    )


class ProyectoTecnologia(Base):
    __tablename__ = "proyectos_tecnologia"

    proyecto_id = Column(Integer, ForeignKey("proyectos.id", ondelete="CASCADE"), primary_key=True)
    lenguaje_principal = Column(String(100), nullable=False)
    repositorio_url = Column(String(255), nullable=True)

    proyecto = relationship("Proyecto", back_populates="tecnologia")


class ProyectoDiseno(Base):
    __tablename__ = "proyectos_diseno"

    proyecto_id = Column(Integer, ForeignKey("proyectos.id", ondelete="CASCADE"), primary_key=True)
    software_utilizado = Column(String(100), nullable=False)
    formato_entrega = Column(String(50), nullable=False)

    proyecto = relationship("Proyecto", back_populates="diseno")


class ProyectoRedaccion(Base):
    __tablename__ = "proyectos_redaccion"

    proyecto_id = Column(Integer, ForeignKey("proyectos.id", ondelete="CASCADE"), primary_key=True)
    cantidad_palabras = Column(Integer, nullable=False)
    idioma = Column(String(50), nullable=False)

    proyecto = relationship("Proyecto", back_populates="redaccion")


class ProyectoMarketing(Base):
    __tablename__ = "proyectos_marketing"

    proyecto_id = Column(Integer, ForeignKey("proyectos.id", ondelete="CASCADE"), primary_key=True)
    plataforma_objetivo = Column(String(100), nullable=False)
    tipo_campana = Column(String(100), nullable=False)

    proyecto = relationship("Proyecto", back_populates="marketing")


class ProyectoAsistencia(Base):
    __tablename__ = "proyectos_asistencia"

    proyecto_id = Column(Integer, ForeignKey("proyectos.id", ondelete="CASCADE"), primary_key=True)
    herramientas_manejo = Column(String(255), nullable=False)
    horas_semanales_requeridas = Column(Integer, nullable=False)

    proyecto = relationship("Proyecto", back_populates="asistencia")


class Factura(Base):
    """Tabla gestionada por la API Node; aqui solo se mapea para resolver la FK de asignaciones."""

    __tablename__ = "facturas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    fecha_emision = Column(Date, nullable=False)
    valor_total = Column(Numeric(10, 2), nullable=False)
    estado_factura = Column(String(50), nullable=False)


class Asignacion(Base):
    """Tabla gestionada por la API Node; aqui solo se lee."""

    __tablename__ = "asignaciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    proyecto_id = Column(Integer, ForeignKey("proyectos.id"), nullable=False, index=True)
    factura_id = Column(Integer, ForeignKey("facturas.id"), nullable=True, unique=True)
    rol_en_proyecto = Column(String(100), nullable=False)
    tarifa_por_hora = Column(Numeric(10, 2), nullable=False)
    temporizador_activo = Column(Boolean, nullable=False, default=False)
    estado_tiempo = Column(SAEnum(EstadoTiempo, name="estado_tiempo"), nullable=False, default=EstadoTiempo.PENDIENTE)

    proyecto = relationship("Proyecto", back_populates="asignaciones")
    registros = relationship("RegistroTiempo", back_populates="asignacion", cascade="all, delete-orphan")


class RegistroTiempo(Base):
    __tablename__ = "registros_tiempo"

    id = Column(Integer, primary_key=True, autoincrement=True)
    asignacion_id = Column(Integer, ForeignKey("asignaciones.id", ondelete="CASCADE"), nullable=False, index=True)
    fecha = Column(Date, nullable=False, default=date.today)
    inicio = Column(DateTime, nullable=True)
    fin = Column(DateTime, nullable=True)
    horas = Column(Numeric(6, 2), nullable=False, default=0)
    origen = Column(SAEnum(OrigenRegistro, name="origen_registro"), nullable=False, default=OrigenRegistro.MANUAL)
    estado = Column(SAEnum(EstadoTiempo, name="estado_tiempo"), nullable=False, default=EstadoTiempo.PENDIENTE)

    asignacion = relationship("Asignacion", back_populates="registros")


class Postulacion(Base):
    __tablename__ = "postulaciones"
    __table_args__ = (
        UniqueConstraint("proyecto_id", "usuario_id", name="uq_postulaciones_proyecto_usuario"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    proyecto_id = Column(
        Integer, ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    usuario_id = Column(Integer, ForeignKey("trabajadores.usuario_id"), nullable=False, index=True)
    tarifa_por_hora = Column(Numeric(10, 2), nullable=False)
    mensaje = Column(Text, nullable=True)
    estado = Column(
        SAEnum(EstadoPostulacion, name="estado_postulacion"),
        nullable=False,
        default=EstadoPostulacion.PENDIENTE,
    )
    fecha_postulacion = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        server_default=text("CURRENT_TIMESTAMP"),
    )

    proyecto = relationship("Proyecto", back_populates="postulaciones")
    trabajador = relationship("Trabajador")
