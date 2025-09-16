from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..deps import admin_auth, get_db
from ..models import (
    User, UserCreate, UserRead,
    Questionnaire, QuestionnaireCreate, QuestionnaireRead,
    Question, QuestionCreate,
    Choice, ChoiceCreate,
    Assignment, AssignmentCreate,
    DiaryEntry,
)


router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(admin_auth)])


@router.get("/users", response_model=List[UserRead])
def list_users(db: Session = Depends(get_db)):
    return db.exec(select(User)).all()


@router.post("/users", response_model=UserRead)
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    user = User(**data.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


@router.put("/users/{user_id}", response_model=UserRead)
def update_user(user_id: int, data: UserCreate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    for k, v in data.model_dump().items():
        setattr(user, k, v)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    db.delete(user)
    db.commit()
    return {"ok": True}


@router.get("/questionnaires")
def list_questionnaires(db: Session = Depends(get_db)):
    q = db.exec(select(Questionnaire)).all()
    return [serialize_questionnaire(qq) for qq in q]


@router.post("/questionnaires")
def create_questionnaire(data: QuestionnaireCreate, db: Session = Depends(get_db)):
    q = Questionnaire(name=data.name, description=data.description, version=data.version, is_active=data.is_active)
    db.add(q)
    db.commit()
    db.refresh(q)
    if data.questions:
        for idx, qd in enumerate(data.questions):
            qu = Question(questionnaire_id=q.id, text=qd.text, type=qd.type, required=qd.required, order=qd.order if qd.order is not None else idx)
            db.add(qu)
            db.commit()
            db.refresh(qu)
            if qd.choices:
                for cidx, cd in enumerate(qd.choices):
                    ch = Choice(question_id=qu.id, text=cd.text, value=cd.value, order=cd.order if cd.order is not None else cidx)
                    db.add(ch)
        db.commit()
    db.refresh(q)
    return serialize_questionnaire(q)


@router.get("/questionnaires/{qid}")
def get_questionnaire(qid: int, db: Session = Depends(get_db)):
    q = db.get(Questionnaire, qid)
    if not q:
        raise HTTPException(404, "Questionnaire not found")
    return serialize_questionnaire(q)


@router.put("/questionnaires/{qid}")
def update_questionnaire(qid: int, data: QuestionnaireCreate, db: Session = Depends(get_db)):
    q = db.get(Questionnaire, qid)
    if not q:
        raise HTTPException(404, "Questionnaire not found")
    q.name = data.name
    q.description = data.description
    q.version = data.version
    q.is_active = data.is_active
    db.add(q)
    db.commit()
    db.refresh(q)
    return serialize_questionnaire(q)


@router.delete("/questionnaires/{qid}")
def delete_questionnaire(qid: int, db: Session = Depends(get_db)):
    q = db.get(Questionnaire, qid)
    if not q:
        raise HTTPException(404, "Questionnaire not found")
    # Cascade manually: delete questions and choices
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
def list_questions(qid: int, db: Session = Depends(get_db)):
    q = db.exec(select(Question).where(Question.questionnaire_id == qid).order_by(Question.order)).all()
    return [serialize_question_with_choices(db, qu) for qu in q]


@router.post("/questionnaires/{qid}/questions")
def add_question(qid: int, data: QuestionCreate, db: Session = Depends(get_db)):
    parent = db.get(Questionnaire, qid)
    if not parent:
        raise HTTPException(404, "Questionnaire not found")
    qu = Question(questionnaire_id=qid, text=data.text, type=data.type, required=data.required, order=data.order or 0)
    db.add(qu)
    db.commit()
    db.refresh(qu)
    if data.choices:
        for idx, cd in enumerate(data.choices):
            ch = Choice(question_id=qu.id, text=cd.text, value=cd.value, order=cd.order if cd.order is not None else idx)
            db.add(ch)
        db.commit()
    return serialize_question_with_choices(db, qu)


@router.put("/questions/{qid}")
def update_question(qid: int, data: QuestionCreate, db: Session = Depends(get_db)):
    qu = db.get(Question, qid)
    if not qu:
        raise HTTPException(404, "Question not found")
    qu.text = data.text
    qu.type = data.type
    qu.required = data.required
    qu.order = data.order
    db.add(qu)
    # Replace choices if provided
    if data.choices is not None:
        cs = db.exec(select(Choice).where(Choice.question_id == qu.id)).all()
        for ch in cs:
            db.delete(ch)
        for idx, cd in enumerate(data.choices):
            db.add(Choice(question_id=qu.id, text=cd.text, value=cd.value, order=cd.order if cd.order is not None else idx))
    db.commit()
    db.refresh(qu)
    return serialize_question_with_choices(db, qu)


@router.delete("/questions/{qid}")
def delete_question(qid: int, db: Session = Depends(get_db)):
    qu = db.get(Question, qid)
    if not qu:
        raise HTTPException(404, "Question not found")
    cs = db.exec(select(Choice).where(Choice.question_id == qu.id)).all()
    for ch in cs:
        db.delete(ch)
    db.delete(qu)
    db.commit()
    return {"ok": True}


@router.get("/entries")
def list_entries(db: Session = Depends(get_db)):
    entries = db.exec(select(DiaryEntry).order_by(DiaryEntry.submitted_at.desc())).all()
    out = []
    for e in entries:
        out.append({
            "id": e.id,
            "user_id": e.user_id,
            "questionnaire_id": e.questionnaire_id,
            "submitted_at": e.submitted_at,
            "answers": e.answers,
        })
    return out


@router.get("/assignments")
def list_assignments(db: Session = Depends(get_db)):
    return db.exec(select(Assignment)).all()


@router.post("/assignments")
def create_assignment(data: AssignmentCreate, db: Session = Depends(get_db)):
    if not db.get(User, data.user_id):
        raise HTTPException(404, "User not found")
    if not db.get(Questionnaire, data.questionnaire_id):
        raise HTTPException(404, "Questionnaire not found")
    a = Assignment(**data.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.delete("/assignments/{aid}")
def delete_assignment(aid: int, db: Session = Depends(get_db)):
    a = db.get(Assignment, aid)
    if not a:
        raise HTTPException(404, "Assignment not found")
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
    # Questions may not be loaded; fetch via relationship order
    questions = sorted(q.questions or [], key=lambda x: x.order)
    out_qs = []
    for qu in questions:
        out_qs.append({
            "id": qu.id,
            "text": qu.text,
            "type": qu.type,
            "required": qu.required,
            "order": qu.order,
            "choices": [{"id": c.id, "text": c.text, "value": c.value, "order": c.order} for c in sorted(qu.choices or [], key=lambda x: x.order)],
        })
    return {
        "id": q.id,
        "name": q.name,
        "description": q.description,
        "version": q.version,
        "is_active": q.is_active,
        "questions": out_qs,
    }
