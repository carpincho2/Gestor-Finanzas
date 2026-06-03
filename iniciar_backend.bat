@echo off
title Servidor Backend Python - Flujo
cd api
if not exist fluxo_venv (
    echo Creando entorno virtual de Python...
    python -m venv fluxo_venv
)
echo Activando entorno virtual...
call fluxo_venv\Scripts\activate
echo Instalando dependencias de Python...
pip install -r requirements.txt
echo Iniciando servidor Uvicorn en http://127.0.0.1:8000...
uvicorn main:app --reload --port 8000
pause
