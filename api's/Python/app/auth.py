import os
from typing import Annotated

import jwt
from dotenv import load_dotenv
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.errors import ErrorAPI

load_dotenv()

ALGORITMO = "HS256"
JWT_SECRET = (os.getenv("JWT_SECRET") or "").strip()

if not JWT_SECRET:
    raise RuntimeError(
        "Falta la variable JWT_SECRET. Copia .env.example a .env y define un secreto "
        "compartido con las demas APIs (se usa para verificar el token Bearer con HS256)."
    )

esquema_bearer = HTTPBearer(
    auto_error=False,
    scheme_name="Bearer",
    description=(
        "Token JWT firmado con HS256 y el secreto compartido `JWT_SECRET`. "
        "Payload esperado: `sub` (id del usuario, texto), `rol` (CLIENTE o TRABAJADOR) "
        "y `exp` (fecha de expiracion en formato epoch)."
    ),
)


class UsuarioToken(BaseModel):
    """Usuario contenido en el token Bearer."""

    id: int
    rol: str


def get_current_user(
    credenciales: Annotated[HTTPAuthorizationCredentials | None, Depends(esquema_bearer)],
) -> UsuarioToken:
    if credenciales is None:
        raise ErrorAPI(
            401,
            "Falta el token de autenticacion. Envia Authorization: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            credenciales.credentials,
            JWT_SECRET,
            algorithms=[ALGORITMO],
            options={"require": ["exp", "sub", "rol"]},
        )
    except jwt.ExpiredSignatureError:
        raise ErrorAPI(
            401,
            "El token ha expirado",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except jwt.PyJWTError:
        raise ErrorAPI(
            401,
            "Token invalido: firma, algoritmo o payload incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    try:
        usuario_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise ErrorAPI(
            401,
            "Token invalido: el claim sub debe ser el id numerico del usuario",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    rol = payload.get("rol")
    if not isinstance(rol, str) or not rol:
        raise ErrorAPI(
            401,
            "Token invalido: falta el claim rol",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return UsuarioToken(id=usuario_id, rol=rol.upper())


def requiere_rol(*roles: str):
    """Dependencia que exige uno de los roles indicados; responde 403 si no coincide."""
    roles_validos = tuple(r.upper() for r in roles)

    def dependency(usuario: Annotated[UsuarioToken, Depends(get_current_user)]) -> UsuarioToken:
        if usuario.rol not in roles_validos:
            raise ErrorAPI(
                403,
                "No tienes permiso para realizar esta operacion "
                f"(rol requerido: {', '.join(roles_validos)}; rol actual: {usuario.rol})",
            )
        return usuario

    return dependency


UsuarioCliente = Annotated[UsuarioToken, Depends(requiere_rol("CLIENTE"))]
UsuarioTrabajador = Annotated[UsuarioToken, Depends(requiere_rol("TRABAJADOR"))]
UsuarioAutenticado = Annotated[UsuarioToken, Depends(get_current_user)]
