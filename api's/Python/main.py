import hmac
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

load_dotenv(Path(__file__).resolve().parent / ".env")

from app.database import SessionLocal
from app.errors import ErrorAPI, registrar_manejadores
from app.routers import postulaciones, proyectos

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("api_proyectos")

INTERNAL_API_KEY = (
    os.getenv("INTERNAL_API_KEY") or "clave-interna-gateway-freelancer-2026"
).strip()

RUTAS_PUBLICAS_INTERNAS = {"/", "/health", "/docs", "/redoc", "/openapi.json"}

DESCRIPCION = (
    "API de proyectos de la plataforma Freelance. Administra proyectos, sus categorias, "
    "asignaciones y postulaciones sobre la base de datos `plataforma_freelance`.\n\n"
    "**Seguridad interna:** este microservicio escucha en `127.0.0.1` y exige el header "
    "`X-Internal-Key` enviado por el API Gateway.\n\n"
    "**Formato de error:** todas las respuestas de error usan el mismo formato que la API de "
    "usuarios: `{\"status\": \"error\", \"message\": \"...\"}` "
    "(422 agrega ademas el listado `errors`)."
)


def _puerto_desde_entorno() -> int:
    crudo = (os.getenv("PORT") or "").strip() or "5000"
    try:
        puerto = int(crudo)
    except ValueError:
        raise RuntimeError(f"La variable PORT del .env debe ser un numero, se encontro: {crudo!r}")
    if not 1 <= puerto <= 65535:
        raise RuntimeError(f"La variable PORT del .env debe estar entre 1 y 65535: {puerto}")
    return puerto


PORT = _puerto_desde_entorno()

app = FastAPI(
    title="API Proyectos - Plataforma Freelance",
    description=DESCRIPCION,
    version="1.0.0",
    contact={"name": "API Proyectos (Python/FastAPI)"},
    openapi_tags=[
        {"name": "Proyectos", "description": "CRUD de proyectos, progreso y asignaciones."},
        {"name": "Postulaciones", "description": "Postulaciones de trabajadores a proyectos."},
    ],
)

_origenes = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origenes,
    allow_credentials="*" not in _origenes,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.middleware("http")
async def verificar_clave_interna(request: Request, call_next):
    if request.method != "OPTIONS" and request.url.path not in RUTAS_PUBLICAS_INTERNAS:
        clave_recibida = request.headers.get("X-Internal-Key") or ""
        if not hmac.compare_digest(clave_recibida, INTERNAL_API_KEY):
            return JSONResponse(
                status_code=403,
                content={
                    "status": "error",
                    "message": "Acceso directo no permitido; use el API Gateway",
                },
            )
    return await call_next(request)


registrar_manejadores(app)
app.include_router(proyectos.router)
app.include_router(postulaciones.router)


@app.get("/", summary="Estado del servicio")
def raiz():
    return {"status": "ok", "service": "API Proyectos"}


@app.get(
    "/health",
    summary="Comprobacion de salud de la base de datos",
    responses={
        503: {
            "description": "La base de datos no responde",
            "content": {
                "application/json": {
                    "example": {"status": "error", "message": "La base de datos no responde"}
                }
            },
        }
    },
)
def health():
    try:
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
        finally:
            db.close()
    except Exception:
        logger.exception("GET /health: fallo el SELECT 1 contra la base de datos")
        raise ErrorAPI(503, "La base de datos no responde") from None
    return {"status": "ok", "service": "API Proyectos", "database": "ok"}


if __name__ == "__main__":
    import uvicorn

    logger.info("Arrancando API Proyectos en 127.0.0.1:%s (solo acceso local / Gateway)", PORT)
    uvicorn.run(app, host="127.0.0.1", port=PORT)
