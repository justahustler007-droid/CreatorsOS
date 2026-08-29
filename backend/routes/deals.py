"""Brand deal CRM endpoints."""
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request

from database import db
from deps import get_current_user
from models import Deal, DealCreate, DealUpdate, DEAL_STAGES
from services.notification_service import create_notification

router = APIRouter(tags=["deals"])


# ── INCOME LEDGER SYNC (single source of truth for revenue) ───────────────
# When a deal becomes "paid", we record a matching income entry tagged with
# `source_deal_id`. This is the canonical revenue record.
#
# Dashboard stats / income tracker / analytics all read from `income` ONLY,
# never re-summing `deal_value` — that previously caused double-counting.
#
# Idempotency: we always look up by source_deal_id first to avoid duplicates
# when a deal flips paid→other→paid.

async def _sync_paid_deal_to_income(user_id: str, deal: dict) -> None:
    """Idempotent: create or update an income entry tied to this deal."""
    existing = await db.income.find_one(
        {"user_id": user_id, "source_deal_id": deal["deal_id"]},
        {"_id": 0},
    )
    if existing:
        # Refresh the amount/notes in case the deal value or brand was edited
        await db.income.update_one(
            {"income_id": existing["income_id"]},
            {"$set": {
                "amount": deal["deal_value"],
                "platform": deal.get("platform", existing.get("platform")),
                "notes": f"Brand Deal · {deal['brand_name']}",
            }},
        )
        return

    income_doc = {
        "income_id": f"inc_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "source": f"Brand Deal · {deal['brand_name']}",
        "platform": deal.get("platform", "Other"),
        "amount": deal["deal_value"],
        "date": datetime.now(timezone.utc).isoformat(),
        "notes": "Auto-recorded from brand deal pipeline",
        "source_deal_id": deal["deal_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.income.insert_one(income_doc)


async def _remove_paid_deal_from_income(user_id: str, deal_id: str) -> None:
    """When a deal moves OUT of 'paid' or is deleted, drop its income row."""
    await db.income.delete_many({"user_id": user_id, "source_deal_id": deal_id})


async def _notify_paid(user_id: str, deal: dict) -> None:
    """Premium-tone notification when a deal closes."""
    await create_notification(
        user_id,
        "outreach_won",
        ctx={
            "brand_name": deal["brand_name"],
            "value_label": f"₹{int(deal['deal_value']):,}",
            "outreach_id": deal.get("deal_id"),
        },
        dedupe_window_minutes=10,
    )


@router.get("/deals", response_model=List[dict])
async def get_deals(user: dict = Depends(get_current_user)):
    """Get all deals for current user."""
    deals = await db.deals.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return deals


@router.get("/deals/pipeline")
async def get_deals_pipeline(user: dict = Depends(get_current_user)):
    """Get deals organized by pipeline stage."""
    deals = await db.deals.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).to_list(1000)

    pipeline = {stage: [] for stage in DEAL_STAGES}
    for deal in deals:
        stage = deal.get("stage", "lead")
        if stage in pipeline:
            pipeline[stage].append(deal)

    return pipeline


@router.post("/deals")
async def create_deal(deal_data: DealCreate, user: dict = Depends(get_current_user)):
    """Create a new deal."""
    deal = Deal(
        user_id=user["user_id"],
        brand_name=deal_data.brand_name,
        platform=deal_data.platform,
        deliverable_type=deal_data.deliverable_type,
        deal_value=deal_data.deal_value,
        stage=deal_data.stage,
        payment_due_date=datetime.fromisoformat(deal_data.payment_due_date.replace('Z', '+00:00')) if deal_data.payment_due_date else None,
        contract_url=deal_data.contract_url,
        notes=deal_data.notes
    )

    doc = deal.model_dump()
    if doc['payment_due_date']:
        doc['payment_due_date'] = doc['payment_due_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()

    await db.deals.insert_one(doc)
    doc.pop('_id', None)

    # If the deal is created already in "paid" state, sync straight away.
    if doc.get("stage") == "paid":
        await _sync_paid_deal_to_income(user["user_id"], doc)
        await _notify_paid(user["user_id"], doc)

    return doc


@router.put("/deals/{deal_id}")
async def update_deal(deal_id: str, deal_data: DealUpdate, user: dict = Depends(get_current_user)):
    """Update a deal."""
    update_dict = {k: v for k, v in deal_data.model_dump().items() if v is not None}

    if 'payment_due_date' in update_dict and update_dict['payment_due_date']:
        update_dict['payment_due_date'] = datetime.fromisoformat(update_dict['payment_due_date'].replace('Z', '+00:00')).isoformat()

    current_deal = await db.deals.find_one({"deal_id": deal_id, "user_id": user["user_id"]}, {"_id": 0})

    if not current_deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    await db.deals.update_one(
        {"deal_id": deal_id, "user_id": user["user_id"]},
        {"$set": update_dict}
    )

    updated_deal = await db.deals.find_one({"deal_id": deal_id, "user_id": user["user_id"]}, {"_id": 0})

    # ── Sync income ledger after the deal write so we re-read the canonical
    # ── post-update document (handles brand_name / deal_value edits too).
    new_stage = updated_deal.get("stage")
    old_stage = current_deal.get("stage")
    if new_stage == "paid":
        await _sync_paid_deal_to_income(user["user_id"], updated_deal)
        if old_stage != "paid":
            await _notify_paid(user["user_id"], updated_deal)
    elif old_stage == "paid" and new_stage != "paid":
        # Reverted out of paid — drop the auto-income row
        await _remove_paid_deal_from_income(user["user_id"], deal_id)

    return updated_deal


@router.put("/deals/{deal_id}/stage")
async def update_deal_stage(deal_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Update deal stage (for drag and drop)."""
    body = await request.json()
    new_stage = body.get("stage")

    if new_stage not in DEAL_STAGES:
        raise HTTPException(status_code=400, detail="Invalid stage")

    current_deal = await db.deals.find_one({"deal_id": deal_id, "user_id": user["user_id"]}, {"_id": 0})

    if not current_deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    old_stage = current_deal.get("stage")

    await db.deals.update_one(
        {"deal_id": deal_id, "user_id": user["user_id"]},
        {"$set": {"stage": new_stage}}
    )

    if new_stage == "paid" and old_stage != "paid":
        current_deal["stage"] = "paid"
        await _sync_paid_deal_to_income(user["user_id"], current_deal)
        await _notify_paid(user["user_id"], current_deal)
    elif old_stage == "paid" and new_stage != "paid":
        await _remove_paid_deal_from_income(user["user_id"], deal_id)

    return {"message": "Stage updated", "stage": new_stage}


@router.delete("/deals/{deal_id}")
async def delete_deal(deal_id: str, user: dict = Depends(get_current_user)):
    """Delete a deal."""
    result = await db.deals.delete_one({"deal_id": deal_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Deal not found")

    # Clean up the matching income entry (if any)
    await _remove_paid_deal_from_income(user["user_id"], deal_id)

    return {"message": "Deal deleted"}
