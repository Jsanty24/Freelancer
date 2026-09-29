"""Errores de la API y helpers de validación."""


class ApiError(Exception):
    def __init__(self, estado: int, mensaje: str, detalles=None):
        super().__init__(mensaje)
        self.estado = estado
        self.mensaje = mensaje
        self.detalles = detalles


def bad_request(mensaje, detalles=None):
    return ApiError(400, mensaje, detalles)


def unauthorized(mensaje="Credenciales inválidas"):
    return ApiError(401, mensaje)


def not_found(mensaje="Recurso no encontrado"):
    return ApiError(404, mensaje)


def conflicto(mensaje):
    return ApiError(409, mensaje)


EMAIL_RE = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"

import re


def texto_obligatorio(datos: dict, campo: str) -> str:
    valor = datos.get(campo)
    if valor is None or not str(valor).strip():
        raise bad_request(f'El campo "{campo}" es obligatorio')
    return str(valor).strip()


def texto_opcional(valor):
    if valor is None or not str(valor).strip():
        return None
    return str(valor).strip()


def email_valido(valor) -> bool:
    return bool(valor) and bool(re.match(EMAIL_RE, str(valor).strip()))


def redondear(valor, decimales=2):
    return round(float(valor) + 1e-12, decimales)
