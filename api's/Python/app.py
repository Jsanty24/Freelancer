"""API Freelancer — Python + Flask.

Implementa el diagrama UML de clases:
Usuario, Trabajador, Cliente, Proyecto, Asignacion, Factura,
enumeración EstadoTiempo y las 5 categorías de proyecto.

Ejecutar:  python app.py
"""

from flask import Flask, jsonify
from flask.json.provider import DefaultJSONProvider

from database import db
from errors import ApiError
from routes import api


class ProveedorJSON(DefaultJSONProvider):
    """Serializa automáticamente las clases del diagrama usando su to_dict()."""

    @staticmethod
    def default(obj):
        if hasattr(obj, "to_dict"):
            return obj.to_dict()
        if hasattr(obj, "value"):
            return obj.value
        return str(obj)


def crear_app() -> Flask:
    app = Flask(__name__)
    app.json = ProveedorJSON(app)
    app.json.sort_keys = False

    @app.after_request
    def cors(respuesta):
        respuesta.headers["Access-Control-Allow-Origin"] = "*"
        respuesta.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
        respuesta.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        return respuesta

    @app.get("/")
    def raiz():
        return jsonify(
            {
                "ok": True,
                "data": {
                    "nombre": "API Freelancer (Python + Flask)",
                    "diagrama": "Usuario, Cliente, Trabajador, Proyecto, "
                    "Asignacion, Factura, EstadoTiempo",
                    "documentacion": "README.md",
                },
            }
        )

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True, "data": {"estado": "ok", **db.estadisticas()}})

    app.register_blueprint(api)

    @app.errorhandler(ApiError)
    def manejador_api_error(err: ApiError):
        return (
            jsonify(
                {"ok": False, "error": {"mensaje": err.mensaje, "detalles": err.detalles}}
            ),
            err.estado,
        )

    @app.errorhandler(404)
    def no_encontrado(_):
        return (
            jsonify(
                {
                    "ok": False,
                    "error": {
                        "mensaje": "Ruta no encontrada",
                        "ruta": f"{_ if isinstance(_, str) else ''}",
                    },
                }
            ),
            404,
        )

    @app.errorhandler(500)
    def error_interno(err):
        return jsonify({"ok": False, "error": {"mensaje": "Error interno del servidor"}}), 500

    @app.errorhandler(Exception)
    def error_no_controlado(err):
        if isinstance(err, ApiError):
            return manejador_api_error(err)
        app.logger.exception("error no controlado: %s", err)
        return jsonify({"ok": False, "error": {"mensaje": "Error interno del servidor"}}), 500

    return app


app = crear_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
