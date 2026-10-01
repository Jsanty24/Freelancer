from datetime import date
from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Proyecto(Base):
    __tablename__ = "proyectos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = Column(Integer, nullable=False)
    nombre_proyecto = Column(String(150), nullable=False)
    descripcion = Column(Text, nullable=True)
    fecha_inicio = Column(Date, nullable=False, default=date.today)
    estado = Column(String(50), nullable=False, default="En curso")

    tecnologia = relationship("ProyectoTecnologia", back_populates="proyecto", uselist=False, cascade="all, delete-orphan")
    diseno = relationship("ProyectoDiseno", back_populates="proyecto", uselist=False, cascade="all, delete-orphan")
    redaccion = relationship("ProyectoRedaccion", back_populates="proyecto", uselist=False, cascade="all, delete-orphan")
    marketing = relationship("ProyectoMarketing", back_populates="proyecto", uselist=False, cascade="all, delete-orphan")
    asistencia = relationship("ProyectoAsistencia", back_populates="proyecto", uselist=False, cascade="all, delete-orphan")

class ProyectoTecnologia(Base):
    __tablename__ = "proyectos_tecnologia"

    proyecto_id = Column(Integer, ForeignKey("proyectos.id", ondelete="CASCADE"), primary_key=True)
    lenguaje_principal = Column(String(100), nullable=False)
    repositorio_url = Column(String(255), nullable=True)

    proyecto = relationship("Proyecto", back_populates="tecnologia")

class ProyectoDiseno(Base):
    __tablename__ = "proyectos_diseño"

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