from datetime import datetime
from typing import Optional, Dict, Any
from enum import Enum

from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import JSON


class Role(str, Enum):
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
    due_at: Optional[datetime] = None
    active: bool = Field(default=True)

    user: "User" = Relationship(back_populates="assignments")  # type: ignore
    questionnaire: "Questionnaire" = Relationship()  # type: ignore


class DiaryEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    questionnaire_id: int = Field(foreign_key="questionnaire.id")
    submitted_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    # Store answers as a JSON-serialised dict (SQLite stores as TEXT)
    answers: Dict[str, Any] = Field(default_factory=dict, sa_type=JSON, sa_column_kwargs={"nullable": False})

    user: "User" = Relationship(back_populates="entries")  # type: ignore
    questionnaire: "Questionnaire" = Relationship(back_populates="entries")  # type: ignore


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    name: str
    participant_code: Optional[str] = Field(default=None, index=True, unique=True)
    role: Role = Field(default=Role.participant)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    assignments: list[Assignment] = Relationship(back_populates="user")  # type: ignore
    entries: list[DiaryEntry] = Relationship(back_populates="user")  # type: ignore


# Redefine Questionnaire fully now that dependencies are declared
class Questionnaire(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: Optional[str] = None
    version: str = "1.0"
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    questions: list[Question] = Relationship(back_populates="questionnaire")  # type: ignore
    entries: list[DiaryEntry] = Relationship(back_populates="questionnaire")  # type: ignore


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
    questions: Optional[list[QuestionCreate]] = None


class QuestionnaireRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    version: str
    is_active: bool
    questions: list[Dict[str, Any]]


class UserCreate(BaseModel):
    email: str
    name: str
    participant_code: Optional[str] = None
    role: Role = Role.participant


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    name: str
    participant_code: Optional[str]
    role: Role
    is_active: bool


class AssignmentCreate(BaseModel):
    user_id: int
    questionnaire_id: int
    due_at: Optional[datetime] = None
    active: bool = True


class EntrySubmit(BaseModel):
    participant_code: str
    questionnaire_id: int
    answers: Dict[str, Any]
