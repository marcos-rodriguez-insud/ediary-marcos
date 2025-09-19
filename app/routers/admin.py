from __future__ import annotations

import secrets
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from ..deps import AdminContext, admin_auth, get_db
from ..models import (
    Assignment,
    AssignmentCreate,
    Choice,
    ChoiceCreate,
    DiaryEntry,
    Project,
    ProjectCreate,
    ProjectRead,
    ProjectsResponse,
    Question,
    QuestionCreate,
    Questionnaire,
    QuestionnaireCreate,
    QuestionnaireRead,
    User,
    UserCreate,
    UserRead,
)


router = APIRouter(prefix="/api/admin", tags=["admin"])

def _generate_unique_assignment_key(db: Session) -> str:
    while True:
        key = secrets.token_urlsafe(8)
        exists = db.exec(select(Questionnaire.id).where(Questionnaire.assignment_key == key)).first()
        if not exists:
            return key


def _ensure_project_allowed(admin_ctx: AdminContext, project_id: int | None) -> None:
    if admin_ctx.is_super_admin:
        return
    if project_id is None or project_id not in admin_ctx.project_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project access denied")


@router.get("/projects", response_model=ProjectsResponse)
def list_projects(
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    if admin_ctx.is_super_admin:
        projects = db.exec(select(Project).order_by(Project.created_at.desc())).all()
    else:
        if not admin_ctx.project_ids:
            projects = []
        else:
            projects = db.exec(
                select(Project)
                .where(Project.id.in_(admin_ctx.project_ids))
                .order_by(Project.created_at.desc())
            ).all()

    items: List[ProjectRead] = []
    for project in projects:
        project_read = ProjectRead.model_validate(project)
        if not admin_ctx.is_super_admin:
            project_read = project_read.model_copy(update={"admin_key": None})
        items.append(project_read)

    return ProjectsResponse(projects=items, is_super_admin=admin_ctx.is_super_admin)


@router.post("/projects", response_model=ProjectRead)
def create_project(
    data: ProjectCreate,
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    if not admin_ctx.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the super admin may create projects")

    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project name is required")

    existing = db.exec(select(Project).where(Project.name == name)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project with this name already exists")

    admin_key = (data.admin_key or secrets.token_urlsafe(16)).strip()
    project = Project(name=name, description=data.description, admin_key=admin_key)
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectRead.model_validate(project)


@router.get("/users", response_model=List[UserRead])
def list_users(
    project_id: int | None = Query(default=None),
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    statement = select(User).order_by(User.created_at.desc())
    if admin_ctx.is_super_admin:
        if project_id is not None:
            statement = statement.where(User.project_id == project_id)
    else:
        if not admin_ctx.project_ids:
            return []
        if project_id is not None:
            _ensure_project_allowed(admin_ctx, project_id)
            statement = statement.where(User.project_id == project_id)
        else:
            statement = statement.where(User.project_id.in_(admin_ctx.project_ids))
    return db.exec(statement).all()


@router.post("/users", response_model=UserRead)
def create_user(
    data: UserCreate,
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    _ensure_project_allowed(admin_ctx, data.project_id)

    user = User(**data.model_dump(exclude_none=True))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users/{user_id}", response_model=UserRead)
def get_user(
    user_id: int,
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    _ensure_project_allowed(admin_ctx, user.project_id)
    return user


@router.put("/users/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    data: UserCreate,
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    _ensure_project_allowed(admin_ctx, user.project_id)
    _ensure_project_allowed(admin_ctx, data.project_id)

    for k, v in data.model_dump().items():
        setattr(user, k, v)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    _ensure_project_allowed(admin_ctx, user.project_id)
    db.delete(user)
    db.commit()
    return {"ok": True}


@router.get("/questionnaires")
def list_questionnaires(
    project_id: int | None = Query(default=None),
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    statement = select(Questionnaire)
    if admin_ctx.is_super_admin:
        if project_id is not None:
            statement = statement.where(Questionnaire.project_id == project_id)
    else:
        if not admin_ctx.project_ids:
            return []
        if project_id is not None:
            _ensure_project_allowed(admin_ctx, project_id)
            statement = statement.where(Questionnaire.project_id == project_id)
        else:
            statement = statement.where(Questionnaire.project_id.in_(admin_ctx.project_ids))
    q = db.exec(statement).all()
    return [serialize_questionnaire(qq) for qq in q]


@router.post("/questionnaires")
def create_questionnaire(
    data: QuestionnaireCreate,
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    _ensure_project_allowed(admin_ctx, data.project_id)

    assignment_key = data.assignment_key or _generate_unique_assignment_key(db)

    q = Questionnaire(
        name=data.name,
        description=data.description,
        version=data.version,
        is_active=data.is_active,
        project_id=data.project_id,
        assignment_key=assignment_key,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    if data.questions:
        for idx, qd in enumerate(data.questions):
            qu = Question(
                questionnaire_id=q.id,
                text=qd.text,
                type=qd.type,
                required=qd.required,
                order=qd.order if qd.order is not None else idx,
            )
            db.add(qu)
            db.commit()
            db.refresh(qu)
            if qd.choices:
                for cidx, cd in enumerate(qd.choices):
                    ch = Choice(
                        question_id=qu.id,
                        text=cd.text,
                        value=cd.value,
                        order=cd.order if cd.order is not None else cidx,
                    )
                    db.add(ch)
        db.commit()
    db.refresh(q)
    return serialize_questionnaire(q)


@router.get("/questionnaires/{qid}")
def get_questionnaire(
    qid: int,
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    q = db.get(Questionnaire, qid)
    if not q:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Questionnaire not found")
    _ensure_project_allowed(admin_ctx, q.project_id)
    return serialize_questionnaire(q)


@router.put("/questionnaires/{qid}")
def update_questionnaire(
    qid: int,
    data: QuestionnaireCreate,
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    q = db.get(Questionnaire, qid)
    if not q:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Questionnaire not found")
    _ensure_project_allowed(admin_ctx, q.project_id)
    _ensure_project_allowed(admin_ctx, data.project_id)

    if data.assignment_key and data.assignment_key != q.assignment_key:
        exists = db.exec(
            select(Questionnaire.id).where(Questionnaire.assignment_key == data.assignment_key)
        ).first()
        if exists and exists != q.id:
            raise HTTPException(status.HTTP_409_CONFLICT, "Assignment key already in use")
        q.assignment_key = data.assignment_key
    elif not q.assignment_key:
        q.assignment_key = _generate_unique_assignment_key(db)

    q.name = data.name
    q.description = data.description
    q.version = data.version
    q.is_active = data.is_active
    q.project_id = data.project_id
    db.add(q)
    db.commit()
    db.refresh(q)
    return serialize_questionnaire(q)


@router.delete("/questionnaires/{qid}")
def delete_questionnaire(
    qid: int,
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    q = db.get(Questionnaire, qid)
    if not q:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Questionnaire not found")
    _ensure_project_allowed(admin_ctx, q.project_id)

    qs = db.exec(select(Question).where(Question.questionnaire_id == qid)).all()
    for qu in qs:
        cs = db.exec(select(Choice).where(Choice.question_id == qu.id)).all()
        for ch in cs:
            db.delete(ch)
        db.delete(qu)
    db.delete(q)
    db.commit()
    return {"ok": True}


@router.get("/questionnaires/{qid}/questions")
def list_questions(
    qid: int,
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    questionnaire = db.get(Questionnaire, qid)
    if not questionnaire:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Questionnaire not found")
    _ensure_project_allowed(admin_ctx, questionnaire.project_id)

    q = db.exec(select(Question).where(Question.questionnaire_id == qid).order_by(Question.order)).all()
    return [serialize_question_with_choices(db, qu) for qu in q]


@router.post("/questionnaires/{qid}/questions")
def add_question(
    qid: int,
    data: QuestionCreate,
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    parent = db.get(Questionnaire, qid)
    if not parent:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Questionnaire not found")
    _ensure_project_allowed(admin_ctx, parent.project_id)

    qu = Question(
        questionnaire_id=qid,
        text=data.text,
        type=data.type,
        required=data.required,
        order=data.order or 0,
    )
    db.add(qu)
    db.commit()
    db.refresh(qu)
    if data.choices:
        for idx, cd in enumerate(data.choices):
            ch = Choice(
                question_id=qu.id,
                text=cd.text,
                value=cd.value,
                order=cd.order if cd.order is not None else idx,
            )
            db.add(ch)
        db.commit()
    return serialize_question_with_choices(db, qu)


@router.put("/questions/{qid}")
def update_question(
    qid: int,
    data: QuestionCreate,
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    qu = db.get(Question, qid)
    if not qu:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    parent = db.get(Questionnaire, qu.questionnaire_id)
    if not parent:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Questionnaire not found")
    _ensure_project_allowed(admin_ctx, parent.project_id)

    qu.text = data.text
    qu.type = data.type
    qu.required = data.required
    qu.order = data.order
    db.add(qu)
    if data.choices is not None:
        cs = db.exec(select(Choice).where(Choice.question_id == qu.id)).all()
        for ch in cs:
            db.delete(ch)
        for idx, cd in enumerate(data.choices):
            db.add(
                Choice(
                    question_id=qu.id,
                    text=cd.text,
                    value=cd.value,
                    order=cd.order if cd.order is not None else idx,
                )
            )
    db.commit()
    db.refresh(qu)
    return serialize_question_with_choices(db, qu)


@router.delete("/questions/{qid}")
def delete_question(
    qid: int,
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    qu = db.get(Question, qid)
    if not qu:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    parent = db.get(Questionnaire, qu.questionnaire_id)
    if not parent:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Questionnaire not found")
    _ensure_project_allowed(admin_ctx, parent.project_id)

    cs = db.exec(select(Choice).where(Choice.question_id == qu.id)).all()
    for ch in cs:
        db.delete(ch)
    db.delete(qu)
    db.commit()
    return {"ok": True}


@router.get("/entries")
def list_entries(
    project_id: int | None = Query(default=None),
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    statement = select(DiaryEntry).order_by(DiaryEntry.submitted_at.desc())
    if admin_ctx.is_super_admin:
        if project_id is not None:
            statement = statement.where(DiaryEntry.project_id == project_id)
    else:
        if not admin_ctx.project_ids:
            return []
        if project_id is not None:
            _ensure_project_allowed(admin_ctx, project_id)
            statement = statement.where(DiaryEntry.project_id == project_id)
        else:
            statement = statement.where(DiaryEntry.project_id.in_(admin_ctx.project_ids))
    entries = db.exec(statement).all()
    out = []
    for e in entries:
        out.append(
            {
                "id": e.id,
                "user_id": e.user_id,
                "questionnaire_id": e.questionnaire_id,
                "project_id": e.project_id,
                "submitted_at": e.submitted_at,
                "answers": e.answers,
            }
        )
    return out


@router.get("/assignments")
def list_assignments(
    project_id: int | None = Query(default=None),
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    statement = select(Assignment)
    if admin_ctx.is_super_admin:
        if project_id is not None:
            statement = statement.where(Assignment.project_id == project_id)
    else:
        if not admin_ctx.project_ids:
            return []
        if project_id is not None:
            _ensure_project_allowed(admin_ctx, project_id)
            statement = statement.where(Assignment.project_id == project_id)
        else:
            statement = statement.where(Assignment.project_id.in_(admin_ctx.project_ids))
    return db.exec(statement).all()


@router.post("/assignments")
def create_assignment(
    data: AssignmentCreate,
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    user = db.get(User, data.user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    questionnaire = db.get(Questionnaire, data.questionnaire_id)
    if not questionnaire:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Questionnaire not found")

    candidate_project_ids = [pid for pid in (data.project_id, user.project_id, questionnaire.project_id) if pid is not None]
    if not candidate_project_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "User and questionnaire must belong to a project")

    project_id = candidate_project_ids[0]
    if any(pid != project_id for pid in candidate_project_ids):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "User and questionnaire must belong to the same project")

    _ensure_project_allowed(admin_ctx, project_id)

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    a = Assignment(
        user_id=user.id,
        questionnaire_id=questionnaire.id,
        project_id=project.id,
        due_at=data.due_at,
        active=data.active,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.delete("/assignments/{aid}")
def delete_assignment(
    aid: int,
    admin_ctx: AdminContext = Depends(admin_auth),
    db: Session = Depends(get_db),
):
    a = db.get(Assignment, aid)
    if not a:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    _ensure_project_allowed(admin_ctx, a.project_id)
    db.delete(a)
    db.commit()
    return {"ok": True}


def serialize_question_with_choices(db: Session, qu: Question):
    choices = db.exec(select(Choice).where(Choice.question_id == qu.id).order_by(Choice.order)).all()
    return {
        "id": qu.id,
        "text": qu.text,
        "type": qu.type,
        "required": qu.required,
        "order": qu.order,
        "choices": [{"id": c.id, "text": c.text, "value": c.value, "order": c.order} for c in choices],
    }


def serialize_questionnaire(q: Questionnaire):
    questions = sorted(q.questions or [], key=lambda x: x.order)
    out_qs = []
    for qu in questions:
        out_qs.append(
            {
                "id": qu.id,
                "text": qu.text,
                "type": qu.type,
                "required": qu.required,
                "order": qu.order,
                "choices": [
                    {"id": c.id, "text": c.text, "value": c.value, "order": c.order}
                    for c in sorted(qu.choices or [], key=lambda x: x.order)
                ],
            }
        )
    return {
        "id": q.id,
        "name": q.name,
        "description": q.description,
        "version": q.version,
        "is_active": q.is_active,
        "project_id": q.project_id,
        "assignment_key": q.assignment_key,
        "questions": out_qs,
    }
