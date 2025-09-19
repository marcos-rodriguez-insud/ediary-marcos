from __future__ import annotations

from contextlib import contextmanager
import os
import secrets
from typing import Optional

from sqlalchemy import inspect
from sqlmodel import SQLModel, Session, create_engine


DB_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
connect_args = {"check_same_thread": False} if DB_URL.startswith("sqlite") else {}
engine = create_engine(DB_URL, echo=False, connect_args=connect_args)


def _get_sqlite_path() -> Optional[str]:
    if engine.url.get_backend_name() != "sqlite":
        return None

    database = engine.url.database
    if not database or database == ":memory:":
        return None

    expanded = os.path.expanduser(database)
    return os.path.abspath(expanded)


def get_or_create_db() -> bool:
    created = False

    sqlite_path = _get_sqlite_path()
    if sqlite_path:
        directory = os.path.dirname(sqlite_path)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)

        if not os.path.exists(sqlite_path):
            SQLModel.metadata.create_all(engine)
            _apply_schema_upgrades()
            return True

    inspector = inspect(engine)
    has_tables = bool(inspector.get_table_names())
    SQLModel.metadata.create_all(engine)
    if not has_tables:
        created = True

    _apply_schema_upgrades()
    return created


def _apply_schema_upgrades() -> None:
    tables_to_check = ["user", "questionnaire", "assignment", "diaryentry", "task"]

    with engine.begin() as conn:
        inspector = inspect(conn)
        table_names = set(inspector.get_table_names())

        project_table = SQLModel.metadata.tables.get("project")
        if "project" not in table_names and project_table is not None:
            project_table.create(conn)
            table_names.add("project")

        column_cache: dict[str, set[str]] = {}

        def ensure_column(table: str, column: str, ddl: str) -> None:
            if table not in table_names:
                return
            cols = column_cache.setdefault(table, {col["name"] for col in inspector.get_columns(table)})
            if column in cols:
                return
            conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
            cols.add(column)

        ensure_column("project", "admin_key", "TEXT")
        ensure_column("user", "project_id", "INTEGER")
        ensure_column("questionnaire", "project_id", "INTEGER")
        ensure_column("questionnaire", "assignment_key", "TEXT")
        ensure_column("assignment", "project_id", "INTEGER")
        ensure_column("diaryentry", "project_id", "INTEGER")
        ensure_column("task", "project_id", "INTEGER")
        ensure_column("task", "user_id", "INTEGER")
        ensure_column("task", "questionnaire_id", "INTEGER")
        ensure_column("task", "task_type", "TEXT")
        ensure_column("task", "due_at", "TIMESTAMP")
        ensure_column("task", "reminder_minutes_before", "INTEGER")
        ensure_column("task", "is_completed", "BOOLEAN")
        ensure_column("task", "completed_at", "TIMESTAMP")
        ensure_column("task", "title", "TEXT")
        ensure_column("task", "description", "TEXT")

        if "project" not in table_names:
            return

        rows = conn.exec_driver_sql("SELECT id, admin_key FROM project").fetchall()
        for pid, key in rows:
            if key:
                continue
            generated = secrets.token_urlsafe(16)
            conn.exec_driver_sql(
                "UPDATE project SET admin_key = ? WHERE id = ?",
                (generated, pid),
            )

        rows = conn.exec_driver_sql("SELECT id, assignment_key FROM questionnaire").fetchall()
        for qid, key in rows:
            if key:
                continue
            generated = secrets.token_urlsafe(8)
            conn.exec_driver_sql(
                "UPDATE questionnaire SET assignment_key = ? WHERE id = ?",
                (generated, qid),
            )


@contextmanager
def get_session() -> Session:
    with Session(engine) as session:
        yield session
