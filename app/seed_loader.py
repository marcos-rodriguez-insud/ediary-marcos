from __future__ import annotations

import json
import os
from typing import Any, Dict

from sqlmodel import Session, select

from .models import Questionnaire, Question, Choice, QuestionType


def load_demo_questionnaire(session: Session) -> None:
    """Load the demo vaginal ring questionnaire from static JSON if not present.

    Idempotent: if a questionnaire with the same name exists, do nothing.
    """
    seed_path = os.path.join(os.path.dirname(__file__), "seed", "vaginal_ring_questionnaire.json")
    if not os.path.isfile(seed_path):
        return

    with open(seed_path, "r", encoding="utf-8") as f:
        data: Dict[str, Any] = json.load(f)

    name = data.get("name")
    if not name:
        return

    existing = session.exec(select(Questionnaire).where(Questionnaire.name == name)).first()
    if existing:
        return

    q = Questionnaire(
        name=data["name"],
        description=data.get("description"),
        version=str(data.get("version", "1.0")),
        is_active=bool(data.get("is_active", True)),
    )
    session.add(q)
    session.commit()
    session.refresh(q)

    questions = data.get("questions", [])
    for idx, qd in enumerate(questions):
        qu = Question(
            questionnaire_id=q.id,
            text=qd["text"],
            type=QuestionType(qd.get("type", "text")),
            required=bool(qd.get("required", True)),
            order=int(qd.get("order", idx)),
        )
        session.add(qu)
        session.commit()
        session.refresh(qu)

        for cidx, cd in enumerate(qd.get("choices", []) or []):
            ch = Choice(
                question_id=qu.id,
                text=cd["text"],
                value=str(cd["value"]),
                order=int(cd.get("order", cidx)),
            )
            session.add(ch)
        session.commit()

