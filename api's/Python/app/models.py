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


class RolUsuario(str, enum.Enum):
    CLIENTE = "CLIENTE"
    TRABAJADOR = "TRABAJADOR"


class EstadoProyecto(str, enum.Enum):
    BORRADOR = "BORRADOR"
    ABIERTO = "ABIERTO"
    EN_CURSO = "EN_CURSO"
    PAUSADO = "PAUSADO"
    FINALIZADO = "FINALIZADO"
    CANCELADO = "CANCELADO"


# Valor por defecto compartido entre modelo, schemas y base de datos.
ESTADO_PROYECTO_INICIAL = EstadoProyecto.ABIERTO

# Transiciones permitidas. FINALIZADO es terminal: no puede volver a ABIERTO.
TRANSICIONES_ESTADO_PROYECTO = {
    EstadoProyecto.BORRADOR: {EstadoProyecto.ABIERTO, EstadoProyecto.CANCELADO},
    EstadoProyecto.ABIERTO: {EstadoProyecto.EN_CURSO, EstadoProyecto.PAUSADO, EstadoProyecto.CANCELADO},
    EstadoProyecto.EN_CURSO: {EstadoProyecto.PAUSADO, EstadoProyecto.FINALIZADO, EstadoProyecto.CANCELADO},
    EstadoProyecto.PAUSADO: {EstadoProyecto.EN_CURSO, EstadoProyecto.CANCELADO},
    EstadoProyecto.FINALIZADO: set(),
    EstadoProyecto.CANCELADO: {EstadoProyecto.ABIERTO},
}


class TipoProyecto(str, enum.Enum):
    TECNOLOGIA = "TECNOLOGIA"
    DISENO = "DISENO"
    REDACCION = "REDACCION"
    MARKETING = "MARKETING"
    ASISTENCIA = "ASISTENCIA"


# Alias para compatibilidad de imports
CategoriaProyecto = TipoProyecto


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


class EstadoFactura(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    APROBADA = "APROBADA"
    RECHAZADA = "RECHAZADA"
    PAGADA = "PAGADA"


# Clave del bloque de detalle (y del campo del body) asociado a cada tipo de proyecto.
BLOQUE_POR_TIPO = {
    TipoProyecto.TECNOLOGIA: "tecnologia",
    TipoProyecto.DISENO: "diseno",
    TipoProyecto.REDACCION: "redaccion",
    TipoProyecto.MARKETING: "marketing",
    TipoProyecto.ASISTENCIA: "asistencia",
}

BLOQUE_POR_CATEGORIA = BLOQUE_POR_TIPO


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(150), nullable=False)
    email = Column(String(150), nullable=False, unique=True)
    telefono = Column(String(20), nullable=True)
    password_hash = Column(String(255), nullable=False, default="$2y$10$placeholderhash")
    rol = Column(SAEnum(RolUsuario, name="rol_usuario"), nullable=False)
    fecha_registro = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        server_default=text("CURRENT_TIMESTAMP"),
    )


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
    cliente_id = Column(Integer, ForeignKey("clientes.usuario_id"), nullable=False, index=True)
    nombre_proyecto = Column(String(150), nullable=False)
    descripcion = Column(Text, nullable=True)
    fecha_inicio = Column(Date, nullable=False, default=date.today)
    tipo = Column(SAEnum(TipoProyecto, name="tipo_proyecto"), nullable=False)
    estado = Column(
        SAEnum(EstadoProyecto, name="estado_proyecto"),
        nullable=False,
        default=ESTADO_PROYECTO_INICIAL,
    )

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
    tipo = Column(
        SAEnum(TipoProyecto, name="tipo_proyecto_tec"),
        nullable=False,
        default=TipoProyecto.TECNOLOGIA,
    )
    lenguaje_principal = Column(String(100), nullable=False)
    repositorio_url = Column(String(255), nullable=True)

    proyecto = relationship("Proyecto", back_populates="tecnologia")


class ProyectoDiseno(Base):
    __tablename__ = "proyectos_diseno"

    proyecto_id = Column(Integer, ForeignKey("proyectos.id", ondelete="CASCADE"), primary_key=True)
    tipo = Column(
        SAEnum(TipoProyecto, name="tipo_proyecto_dis"),
        nullable=False,
        default=TipoProyecto.DISENO,
    )
    software_utilizado = Column(String(100), nullable=False)
    formato_entrega = Column(String(50), nullable=False)

    proyecto = relationship("Proyecto", back_populates="diseno")


class ProyectoRedaccion(Base):
    __tablename__ = "proyectos_redaccion"

    proyecto_id = Column(Integer, ForeignKey("proyectos.id", ondelete="CASCADE"), primary_key=True)
    tipo = Column(
        SAEnum(TipoProyecto, name="tipo_proyecto_red"),
        nullable=False,
        default=TipoProyecto.REDACCION,
    )
    cantidad_palabras = Column(Integer, nullable=False)
    idioma = Column(String(50), nullable=False)

    proyecto = relationship("Proyecto", back_populates="redaccion")


class ProyectoMarketing(Base):
    __tablename__ = "proyectos_marketing"

    proyecto_id = Column(Integer, ForeignKey("proyectos.id", ondelete="CASCADE"), primary_key=True)
    tipo = Column(
        SAEnum(TipoProyecto, name="tipo_proyecto_mkt"),
        nullable=False,
        default=TipoProyecto.MARKETING,
    )
    plataforma_objetivo = Column(String(100), nullable=False)
    tipo_campana = Column(String(100), nullable=False)

    proyecto = relationship("Proyecto", back_populates="marketing")


class ProyectoAsistencia(Base):
    __tablename__ = "proyectos_asistencia"

    proyecto_id = Column(Integer, ForeignKey("proyectos.id", ondelete="CASCADE"), primary_key=True)
    tipo = Column(
        SAEnum(TipoProyecto, name="tipo_proyecto_asi"),
        nullable=False,
        default=TipoProyecto.ASISTENCIA,
    )
    herramientas_manejo = Column(String(255), nullable=False)
    horas_semanales_requeridas = Column(Integer, nullable=False)

    proyecto = relationship("Proyecto", back_populates="asistencia")


class Factura(Base):
    """Tabla gestionada por la API Node; aqui se mapea para resolver la FK de registros_tiempo."""

    __tablename__ = "facturas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cliente_id = Column(Integer, ForeignKey("clientes.usuario_id"), nullable=False)
    trabajador_id = Column(Integer, ForeignKey("trabajadores.usuario_id"), nullable=False)
    fecha_emision = Column(Date, nullable=False)
    valor_total = Column(Numeric(10, 2), nullable=False)
    estado_factura = Column(
        SAEnum(EstadoFactura, name="estado_factura"),
        nullable=False,
        default=EstadoFactura.PENDIENTE,
    )


class Asignacion(Base):
    """Tabla gestionada por la API Node; aqui se consulta para asignaciones y progreso."""

    __tablename__ = "asignaciones"
    __table_args__ = (
        UniqueConstraint("trabajador_id", "proyecto_id", name="uq_asignacion"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    trabajador_id = Column(Integer, ForeignKey("trabajadores.usuario_id"), nullable=False, index=True)
    proyecto_id = Column(Integer, ForeignKey("proyectos.id"), nullable=False, index=True)
    rol_en_proyecto = Column(String(100), nullable=False)
    tarifa_por_hora = Column(Numeric(10, 2), nullable=False)
    temporizador_inicio = Column(DateTime, nullable=True)

    proyecto = relationship("Proyecto", back_populates="asignaciones")
    registros = relationship(
        "RegistroTiempo", back_populates="asignacion", cascade="all, delete-orphan"
    )


class RegistroTiempo(Base):
    __tablename__ = "registros_tiempo"

    id = Column(Integer, primary_key=True, autoincrement=True)
    asignacion_id = Column(Integer, ForeignKey("asignaciones.id"), nullable=False, index=True)
    inicio = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
    fin = Column(DateTime, nullable=True)
    horas = Column(Numeric(5, 2), nullable=False)
    tarifa_aplicada = Column(Numeric(10, 2), nullable=True)
    origen = Column(SAEnum(OrigenRegistro, name="origen_registro"), nullable=False)
    estado = Column(
        SAEnum(EstadoTiempo, name="estado_tiempo"),
        nullable=False,
        default=EstadoTiempo.PENDIENTE,
    )
    factura_id = Column(Integer, ForeignKey("facturas.id"), nullable=True)

    asignacion = relationship("Asignacion", back_populates="registros")


class Postulacion(Base):
    __tablename__ = "postulaciones"
    __table_args__ = (
        UniqueConstraint("trabajador_id", "proyecto_id", name="uq_postulacion"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    trabajador_id = Column(
        Integer, ForeignKey("trabajadores.usuario_id", ondelete="CASCADE"), nullable=False, index=True
    )
    proyecto_id = Column(
        Integer, ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mensaje = Column(Text, nullable=True)
    tarifa_propuesta = Column(Numeric(10, 2), nullable=False)
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
