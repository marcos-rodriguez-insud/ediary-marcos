from datetime import datetime
from typing import Optional, Dict, Any
from enum import Enum

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import JSON


class Role(str, Enum):
    super_admin = "super_admin"
    admin = "admin"
    participant = "participant"

class QuestionType(str, Enum):
    text = "text"
    number = "number"
    date = "date"
    time = "time"
    single_choice = "single_choice"
    multi_choice = "multi_choice"
    likert = "likert"


class TaskType(str, Enum):
    fill_form = "fill_form"
    reminder = "reminder"


class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    description: Optional[str] = None
    admin_key: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    users: list["User"] = Relationship(back_populates="project")  # type: ignore
    questionnaires: list["Questionnaire"] = Relationship(back_populates="project")  # type: ignore
    assignments: list["Assignment"] = Relationship(back_populates="project")  # type: ignore
    entries: list["DiaryEntry"] = Relationship(back_populates="project")  # type: ignore
    tasks: list["Task"] = Relationship(back_populates="project")  # type: ignore


class Choice(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    question_id: int = Field(foreign_key="question.id")
    text: str
    value: str
    order: int = 0

    question: "Question" = Relationship(back_populates="choices")  # type: ignore


class Question(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    questionnaire_id: int = Field(foreign_key="questionnaire.id")
    text: str
    type: QuestionType = Field(default=QuestionType.text)
    required: bool = Field(default=True)
    order: int = 0

    questionnaire: "Questionnaire" = Relationship(back_populates="questions")  # type: ignore
    choices: list[Choice] = Relationship(back_populates="question")  # type: ignore


class Assignment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    questionnaire_id: int = Field(foreign_key="questionnaire.id")
    project_id: Optional[int] = Field(default=None, foreign_key="project.id")
    due_at: Optional[datetime] = None
    active: bool = Field(default=True)

    user: "User" = Relationship(back_populates="assignments")  # type: ignore
    questionnaire: "Questionnaire" = Relationship()  # type: ignore
    project: Project = Relationship(back_populates="assignments")  # type: ignore


class DiaryEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    questionnaire_id: int = Field(foreign_key="questionnaire.id")
    project_id: Optional[int] = Field(default=None, foreign_key="project.id")
    submitted_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    # Store answers as a JSON-serialised dict (SQLite stores as TEXT)
    answers: Dict[str, Any] = Field(default_factory=dict, sa_type=JSON, sa_column_kwargs={"nullable": False})

    user: "User" = Relationship(back_populates="entries")  # type: ignore
    questionnaire: "Questionnaire" = Relationship(back_populates="entries")  # type: ignore
    project: Project = Relationship(back_populates="entries")  # type: ignore


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    name: str
    participant_code: Optional[str] = Field(default=None, index=True, unique=True)
    project_id: Optional[int] = Field(default=None, foreign_key="project.id")
    role: Role = Field(default=Role.participant)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    assignments: list[Assignment] = Relationship(back_populates="user")  # type: ignore
    entries: list[DiaryEntry] = Relationship(back_populates="user")  # type: ignore
    tasks: list["Task"] = Relationship(back_populates="user")  # type: ignore
    project: Project = Relationship(back_populates="users")  # type: ignore


# Redefine Questionnaire fully now that dependencies are declared
class Questionnaire(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: Optional[str] = None
    version: str = "1.0"
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    project_id: Optional[int] = Field(default=None, foreign_key="project.id")
    assignment_key: Optional[str] = Field(default=None, index=True, unique=True)

    questions: list[Question] = Relationship(back_populates="questionnaire")  # type: ignore
    entries: list[DiaryEntry] = Relationship(back_populates="questionnaire")  # type: ignore
    project: Project = Relationship(back_populates="questionnaires")  # type: ignore
    tasks: list["Task"] = Relationship(back_populates="questionnaire")  # type: ignore


class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id")
    user_id: int = Field(foreign_key="user.id")
    questionnaire_id: Optional[int] = Field(default=None, foreign_key="questionnaire.id")
    title: str
    description: Optional[str] = None
    task_type: TaskType = Field(default=TaskType.reminder)
    due_at: Optional[datetime] = None
    reminder_minutes_before: Optional[int] = None
    is_completed: bool = Field(default=False)
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    project: Project = Relationship(back_populates="tasks")  # type: ignore
    user: User = Relationship(back_populates="tasks")  # type: ignore
    questionnaire: Optional[Questionnaire] = Relationship(back_populates="tasks")  # type: ignore


# Pydantic models for API I/O
from pydantic import BaseModel, ConfigDict


class ChoiceCreate(BaseModel):
    text: str
    value: str
    order: int = 0


class QuestionCreate(BaseModel):
    text: str
    type: QuestionType = QuestionType.text
    required: bool = True
    order: int = 0
    choices: Optional[list[ChoiceCreate]] = None


class QuestionnaireCreate(BaseModel):
    name: str
    description: Optional[str] = None
    version: str = "1.0"
    is_active: bool = True
    project_id: int
    assignment_key: Optional[str] = None
    questions: Optional[list[QuestionCreate]] = None


class QuestionnaireRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    version: str
    is_active: bool
    project_id: Optional[int]
    assignment_key: str
    questions: list[Dict[str, Any]]


class UserCreate(BaseModel):
    email: str
    name: str
    participant_code: Optional[str] = None
    role: Role = Role.participant
    project_id: int


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    name: str
    participant_code: Optional[str]
    role: Role
    is_active: bool
    project_id: Optional[int]


class AssignmentCreate(BaseModel):
    user_id: int
    questionnaire_id: int
    due_at: Optional[datetime] = None
    active: bool = True
    project_id: Optional[int] = None


class EntrySubmit(BaseModel):
    participant_code: str
    questionnaire_id: int
    answers: Dict[str, Any]


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    admin_key: Optional[str] = None


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: Optional[str]
    admin_key: Optional[str] = None


class ProjectsResponse(BaseModel):
    projects: list[ProjectRead]
    is_super_admin: bool


class TaskCreate(BaseModel):
    project_id: int
    user_id: int
    questionnaire_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    task_type: TaskType = TaskType.reminder
    due_at: Optional[datetime] = None
    reminder_minutes_before: Optional[int] = None


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    user_id: int
    questionnaire_id: Optional[int]
    title: str
    description: Optional[str]
    task_type: TaskType
    due_at: Optional[datetime]
    reminder_minutes_before: Optional[int]
    is_completed: bool
    completed_at: Optional[datetime]
    created_at: datetime
    questionnaire_name: Optional[str] = None
    auto_completed: bool = False


class TaskUpdate(BaseModel):
    questionnaire_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    task_type: Optional[TaskType] = None
    due_at: Optional[datetime] = None
    reminder_minutes_before: Optional[int] = None
    is_completed: Optional[bool] = None
    completed_at: Optional[datetime] = None
