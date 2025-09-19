from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List

from fastapi import Header, HTTPException, Request, status
from sqlmodel import Session, select

from .database import get_session
from .models import Project


ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "dev-admin-key")


@dataclass
class AdminContext:
    api_key: str
    is_super_admin: bool
    project_ids: List[int]


def admin_auth(request: Request, x_admin_key: str | None = Header(default=None)) -> AdminContext:
    if request.method == "OPTIONS":
        return AdminContext(api_key=x_admin_key or "", is_super_admin=False, project_ids=[])

    if not x_admin_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin key")

    if ADMIN_API_KEY and x_admin_key == ADMIN_API_KEY:
        with get_session() as session:
            project_ids = session.exec(select(Project.id)).all()
        return AdminContext(api_key=x_admin_key, is_super_admin=True, project_ids=[int(pid) for pid in project_ids])

    with get_session() as session:
        project_ids = session.exec(select(Project.id).where(Project.admin_key == x_admin_key)).all()

    if not project_ids:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin key")

    return AdminContext(api_key=x_admin_key, is_super_admin=False, project_ids=[int(pid) for pid in project_ids])


def get_db() -> Session:
    # Wrapper for dependency injection
    with get_session() as session:
        yield session
