from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..deps import get_db
from ..models import User, Assignment, Questionnaire, DiaryEntry, EntrySubmit, Task, TaskType, TaskRead


router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/questionnaires")
def get_assigned_questionnaires(participant_code: str, db: Session = Depends(get_db)):
    user = db.exec(select(User).where(User.participant_code == participant_code)).first()
    if not user:
        raise HTTPException(404, "Participant not found")
    assignments = db.exec(select(Assignment).where(Assignment.user_id == user.id, Assignment.active == True)).all()
    result = []
    for a in assignments:
        q = db.get(Questionnaire, a.questionnaire_id)
        if q and q.is_active:
            qs = sorted(q.questions or [], key=lambda x: x.order)
            result.append({
                "questionnaire_id": q.id,
                "name": q.name,
                "description": q.description,
                "version": q.version,
                "questions": [{
                    "id": qu.id,
                    "text": qu.text,
                    "type": qu.type,
                    "required": qu.required,
                    "order": qu.order,
                    "choices": [{"id": c.id, "text": c.text, "value": c.value, "order": c.order} for c in sorted(qu.choices or [], key=lambda x: x.order)],
                } for qu in qs]
            })
    return {"user": {"id": user.id, "name": user.name}, "assignments": result}


@router.get("/tasks")
def get_tasks(participant_code: str, db: Session = Depends(get_db)):
    user = db.exec(select(User).where(User.participant_code == participant_code)).first()
    if not user:
        raise HTTPException(404, "Participant not found")

    tasks = db.exec(
        select(Task)
        .where(Task.user_id == user.id, Task.is_completed == False)
        .order_by(Task.due_at.is_(None), Task.due_at)
    ).all()

    response = []
    auto_completed = []
    for task in tasks:
        data = TaskRead.model_validate(task).model_dump()
        data["task_type"] = task.task_type.value

        if task.questionnaire_id:
            questionnaire = db.get(Questionnaire, task.questionnaire_id)
            if questionnaire:
                data["questionnaire_name"] = questionnaire.name

        if task.task_type == TaskType.reminder:
            task.is_completed = True
            task.completed_at = datetime.utcnow()
            auto_completed.append(task)
            data["auto_completed"] = True

        response.append(data)

    if auto_completed:
        db.add_all(auto_completed)
        db.commit()

    return {"tasks": response}


@router.post("/submit")
def submit_entry(payload: EntrySubmit, db: Session = Depends(get_db)):
    user = db.exec(select(User).where(User.participant_code == payload.participant_code)).first()
    if not user:
        raise HTTPException(404, "Participant not found")
    q = db.get(Questionnaire, payload.questionnaire_id)
    if not q:
        raise HTTPException(404, "Questionnaire not found")
    entry = DiaryEntry(user_id=user.id, questionnaire_id=q.id, answers=payload.answers)
    if user.project_id:
        entry.project_id = user.project_id
    db.add(entry)
    related_tasks = db.exec(
        select(Task).where(
            Task.user_id == user.id,
            Task.questionnaire_id == q.id,
            Task.task_type == TaskType.fill_form,
            Task.is_completed == False,
        )
    ).all()
    for task in related_tasks:
        task.is_completed = True
        task.completed_at = datetime.utcnow()
        db.add(task)
    db.commit()
    db.refresh(entry)
    return {"ok": True, "entry_id": entry.id}
