'use strict';

/**
 * Clases de tipos / categorías de proyecto (diagrama, puntos 8 a 12).
 * Las 5 se relacionan con Proyecto (1 -> N) mediante `tipoCategoria`.
 */

class CategoriaProyecto {
  constructor(datos = {}) {
    this.tipo = new.target.TIPO;
    Object.assign(this, datos);
  }

  toJSON() {
    return { tipo: this.tipo, ...this.campos() };
  }

  campos() {
    return {};
  }

  validar() {
    const errores = this.campos()
      .map(([clave, valor]) => (this[clave] === undefined || this[clave] === null ? clave : null))
      .filter(Boolean);
    return { valido: errores.length === 0, errores };
  }
}

class TecnologiaYProgramacion extends CategoriaProyecto {
  static TIPO = 'TECNOLOGIA_Y_PROGRAMACION';
  /** -lenguajePrincipal: String */
  constructor({ lenguajePrincipal = null, repositorioUrl = null } = {}) {
    super();
    this.lenguajePrincipal = lenguajePrincipal;
    this.repositorioUrl = repositorioUrl;
  }
  campos() {
    return [
      ['lenguajePrincipal', this.lenguajePrincipal],
      ['repositorioUrl', this.repositorioUrl],
    ];
  }
}

class DisenoYMultimedia extends CategoriaProyecto {
  static TIPO = 'DISENO_Y_MULTIMEDIA';
  /** -softwareUtilizado: String, -formatoEntrega: String */
  constructor({ softwareUtilizado = null, formatoEntrega = null } = {}) {
    super();
    this.softwareUtilizado = softwareUtilizado;
    this.formatoEntrega = formatoEntrega;
  }
  campos() {
    return [
      ['softwareUtilizado', this.softwareUtilizado],
      ['formatoEntrega', this.formatoEntrega],
    ];
  }
}

class RedaccionYContenido extends CategoriaProyecto {
  static TIPO = 'REDACCION_Y_CONTENIDO';
  /** -cantidadPalabras: int, -idioma: String */
  constructor({ cantidadPalabras = null, idioma = null } = {}) {
    super();
    this.cantidadPalabras = cantidadPalabras != null ? Number(cantidadPalabras) : null;
    this.idioma = idioma;
  }
  campos() {
    return [
      ['cantidadPalabras', this.cantidadPalabras],
      ['idioma', this.idioma],
    ];
  }
}

class MarketingDigitalYRedesSociales extends CategoriaProyecto {
  static TIPO = 'MARKETING_DIGITAL_Y_REDES_SOCIALES';
  /** -plataformaObjetivo: String, -tipoCampana: String */
  constructor({ plataformaObjetivo = null, tipoCampana = null } = {}) {
    super();
    this.plataformaObjetivo = plataformaObjetivo;
    this.tipoCampana = tipoCampana;
  }
  campos() {
    return [
      ['plataformaObjetivo', this.plataformaObjetivo],
      ['tipoCampana', this.tipoCampana],
    ];
  }
}

class AsistenciaVirtualYAdministracion extends CategoriaProyecto {
  static TIPO = 'ASISTENCIA_VIRTUAL_Y_ADMINISTRACION';
  /** -herramientasManejo: String, -horasSemanalesRequeridas: int */
  constructor({ herramientasManejo = null, horasSemanalesRequeridas = null } = {}) {
    super();
    this.herramientasManejo = herramientasManejo;
    this.horasSemanalesRequeridas =
      horasSemanalesRequeridas != null ? Number(horasSemanalesRequeridas) : null;
  }
  campos() {
    return [
      ['herramientasManejo', this.herramientasManejo],
      ['horasSemanalesRequeridas', this.horasSemanalesRequeridas],
    ];
  }
}

const CATEGORIAS = {
  [TecnologiaYProgramacion.TIPO]: TecnologiaYProgramacion,
  [DisenoYMultimedia.TIPO]: DisenoYMultimedia,
  [RedaccionYContenido.TIPO]: RedaccionYContenido,
  [MarketingDigitalYRedesSociales.TIPO]: MarketingDigitalYRedesSociales,
  [AsistenciaVirtualYAdministracion.TIPO]: AsistenciaVirtualYAdministracion,
};

function crearCategoria(tipo, datos = {}) {
  const Clase = CATEGORIAS[tipo];
  if (!Clase) return null;
  return new Clase(datos);
}

module.exports = {
  CategoriaProyecto,
  TecnologiaYProgramacion,
  DisenoYMultimedia,
  RedaccionYContenido,
  MarketingDigitalYRedesSociales,
  AsistenciaVirtualYAdministracion,
  CATEGORIAS,
  crearCategoria,
};
