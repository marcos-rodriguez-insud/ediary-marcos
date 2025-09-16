from __future__ import annotations

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from .database import init_db, engine
from .routers import admin as admin_router
from .routers import user as user_router
from sqlmodel import Session
from .seed_loader import load_demo_questionnaire


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Initialize DB and load demo seed on startup
        init_db()
        with Session(engine) as session:
            load_demo_questionnaire(session)
        yield

    app = FastAPI(title="e-Diary (Clinical Trials)", lifespan=lifespan)

    # CORS for local dev and simple frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
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
