"""Income tracking endpoints."""
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from database import db
from deps import get_current_user
from models import Income, IncomeCreate

router = APIRouter(tags=["income"])


@router.get("/income", response_model=List[dict])
async def get_income(user: dict = Depends(get_current_user)):
    """Get all income records for current user."""
    income_list = await db.income.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("date", -1).to_list(1000)
    return income_list


@router.post("/income")
async def create_income(income_data: IncomeCreate, user: dict = Depends(get_current_user)):
    """Create a new income record."""
    income = Income(
        user_id=user["user_id"],
        source=income_data.source,
        platform=income_data.platform,
        amount=income_data.amount,
        date=datetime.fromisoformat(income_data.date.replace('Z', '+00:00')),
        notes=income_data.notes
    )

    doc = income.model_dump()
    doc['date'] = doc['date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()

    await db.income.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.delete("/income/{income_id}")
async def delete_income(income_id: str, user: dict = Depends(get_current_user)):
    """Delete an income record."""
    result = await db.income.delete_one({"income_id": income_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Income not found")
    return {"message": "Income deleted"}
