"""Deprecated demo seed loader (no longer used)."""

from __future__ import annotations

from sqlmodel import Session


def load_demo_questionnaire(session: Session) -> None:  # noqa: D401
    """No-op placeholder retained for backwards compatibility."""
    return None
