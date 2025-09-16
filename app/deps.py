from __future__ import annotations

import os
from fastapi import Header, HTTPException, status, Depends
from sqlmodel import Session
from .database import get_session


ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "dev-admin-key")


def admin_auth(x_admin_key: str | None = Header(default=None)) -> None:
    if ADMIN_API_KEY and x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin key")


def get_db() -> Session:
    # Wrapper for dependency injection
    with get_session() as session:
        yield session

