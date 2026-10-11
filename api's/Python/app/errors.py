import logging

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("api_proyectos")

FORMATO_ERROR = {"status": "error", "message": "<texto legible>"}


class ErrorAPI(Exception):
    """Error de negocio/control que se traduce al formato de error acordado."""

    def __init__(self, status_code: int, message: str, headers: dict | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.headers = headers or {}


def _respuesta(status_code: int, message: str, headers: dict | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"status": "error", "message": message},
        headers=headers,
    )


def manejar_error_api(request: Request, exc: ErrorAPI) -> JSONResponse:
    if exc.status_code >= 500:
        logger.error("Error de negocio %s en %s %s: %s", exc.status_code, request.method, request.url.path, exc.message)
    return _respuesta(exc.status_code, exc.message, exc.headers)


def manejar_http_exception(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detalle = exc.detail
    if not isinstance(detalle, str):
        detalle = str(detalle)
    return _respuesta(exc.status_code, detalle, getattr(exc, "headers", None))


def manejar_validacion(request: Request, exc: RequestValidationError) -> JSONResponse:
    errores = []
    for error in exc.errors():
        errores.append(
            {
                "campo": ".".join(str(p) for p in error.get("loc", []) if p != "body") or "body",
                "mensaje": error.get("msg", ""),
                "tipo": error.get("type", ""),
            }
        )
    resumen = errores[0]["mensaje"] if errores else "Cuerpo de la peticion invalido"
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "message": f"Error de validacion: {resumen}",
            "errors": errores,
        },
    )


def manejar_error_interno(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Error no controlado en %s %s", request.method, request.url.path)
    return _respuesta(500, "Error interno del servidor")


def respuesta_error(status_code: int, description: str, mensaje: str) -> dict:
    """Documentacion OpenAPI de una respuesta de error (formato {status, message})."""
    return {
        "description": description,
        "content": {"application/json": {"example": {"status": "error", "message": mensaje}}},
    }


RESPUESTAS_AUTH = {
    401: respuesta_error(401, "No autenticado", "Falta el token de autenticacion o el token ha expirado"),
    403: respuesta_error(403, "Prohibido", "El rol autenticado no tiene permiso para esta operacion"),
}

RESPUESTAS_RECURSO = {
    **RESPUESTAS_AUTH,
    404: respuesta_error(404, "No encontrado", "El recurso solicitado no existe"),
}


def registrar_manejadores(app) -> None:
    app.add_exception_handler(ErrorAPI, manejar_error_api)
    app.add_exception_handler(StarletteHTTPException, manejar_http_exception)
    app.add_exception_handler(RequestValidationError, manejar_validacion)
    app.add_exception_handler(Exception, manejar_error_interno)
