from fastapi import FastAPI
from app.routers import proyectos

app = FastAPI(
    title="API de Plataforma Freelance",
    version="1.0.0",
)

app.include_router(proyectos.router)

@app.get("/")
def root():
    return {"message": "si, la api si sirve"}