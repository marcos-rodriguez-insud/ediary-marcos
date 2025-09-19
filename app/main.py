from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import engine, get_or_create_db
from .routers import admin as admin_router
from .routers import user as user_router


def _load_cors_origins() -> List[str]:
    env_value = os.getenv("CORS_ORIGINS")
    if env_value:
        origins = [origin.strip() for origin in env_value.split(",") if origin.strip()]
        if "*" in origins:
            return ["*"]
        if origins:
            return origins

    return [
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Initialize DB and load demo seed on startup
        get_or_create_db()
        yield

    allowed_origins = _load_cors_origins()

    app = FastAPI(title="e-Diary (Clinical Trials)", lifespan=lifespan)

    # CORS for local dev and simple frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"]
    )

    # API routers
    app.include_router(admin_router.router)
    app.include_router(user_router.router)

    # Static files
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    if not os.path.isdir(static_dir):
        os.makedirs(static_dir, exist_ok=True)
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

    return app


app = create_app()
