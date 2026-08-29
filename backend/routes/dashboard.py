"""Dashboard aggregation endpoints."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from database import db
from deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    """Get dashboard statistics.

    Single-source-of-truth: revenue is computed from the `income` collection
    only. Paid deals auto-create matching income rows tagged with
    `source_deal_id`, so we never re-sum `deal_value` here (used to cause
    double-counting).
    """
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    all_income = await db.income.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    all_deals = await db.deals.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)

    # ── Revenue (from income only) ──────────────────────────────────────
    total_revenue = sum(i['amount'] for i in all_income)

    def _income_dt(i):
        try:
            return datetime.fromisoformat(i['date']).replace(tzinfo=timezone.utc) if isinstance(i['date'], str) else i['date']
        except Exception:
            return now

    month_revenue = sum(i['amount'] for i in all_income if _income_dt(i) >= month_start)

    # ── Deal counts (from deals collection) ─────────────────────────────
    active_deals = len([d for d in all_deals if d.get('stage') in ['lead', 'negotiating', 'confirmed', 'content_delivered', 'payment_pending']])
    paid_deals = len([d for d in all_deals if d.get('stage') == 'paid'])

    pending_payments = sum(
        d['deal_value'] for d in all_deals
        if d.get('stage') in ['confirmed', 'content_delivered', 'payment_pending']
    )

    # ── Revenue-by-source (donut/pie chart) — income is the canonical truth.
    revenue_by_source = {}
    for income in all_income:
        source = income.get('source') or 'Other'
        revenue_by_source[source] = revenue_by_source.get(source, 0) + income['amount']

    # ── Monthly revenue (last 6 months) ─────────────────────────────────
    monthly_revenue = []
    for i in range(5, -1, -1):
        month = now - timedelta(days=30 * i)
        month_name = month.strftime('%b')
        month_total = sum(
            inc['amount'] for inc in all_income
            if _income_dt(inc).strftime('%Y-%m') == month.strftime('%Y-%m')
        )
        monthly_revenue.append({"month": month_name, "revenue": month_total})

    return {
        "total_revenue": total_revenue,
        "month_revenue": month_revenue,
        "active_deals": active_deals,
        "paid_deals": paid_deals,
        "pending_payments": pending_payments,
        "revenue_by_source": [{"name": k, "value": v} for k, v in revenue_by_source.items()],
        "monthly_revenue": monthly_revenue
    }


@router.get("/insights")
async def get_creator_insights(user: dict = Depends(get_current_user)):
    """Get creator insights for dashboard."""
    all_income = await db.income.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    all_deals = await db.deals.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    profile = await db.creator_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})

    total_revenue = sum(i['amount'] for i in all_income)
    paid_deals = len([d for d in all_deals if d.get('stage') == 'paid'])
    avg_deal_value = total_revenue / paid_deals if paid_deals > 0 else 0

    platform_revenue = {}
    for income in all_income:
        platform = income['platform']
        platform_revenue[platform] = platform_revenue.get(platform, 0) + income['amount']

    if platform_revenue:
        top_platform = max(platform_revenue.items(), key=lambda x: x[1])[0]
    elif profile and profile.get('detected_platform'):
        detected = profile['detected_platform']
        top_platform = 'YouTube & Instagram' if detected == 'both' else detected.capitalize()
    else:
        top_platform = "N/A"

    return {
        "total_deals_closed": paid_deals,
        "total_revenue": total_revenue,
        "average_deal_value": round(avg_deal_value, 2),
        "top_platform": top_platform,
        "platform_revenue": [{"platform": k, "revenue": v} for k, v in platform_revenue.items()]
    }


@router.get("/milestones")
async def get_milestones(user: dict = Depends(get_current_user)):
    """Get creator milestones - only return achieved ones."""
    all_income = await db.income.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    all_deals = await db.deals.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)

    total_revenue = sum(i['amount'] for i in all_income)
    total_deals = len(all_deals)
    paid_deals = len([d for d in all_deals if d.get('stage') == 'paid'])

    achieved = []
    if total_deals >= 1:
        achieved.append({"id": "first_deal", "name": "First Deal Logged", "achieved": True})
    if total_revenue >= 10000:
        achieved.append({"id": "revenue_10k", "name": "First ₹10,000 Earned", "achieved": True})
    if paid_deals >= 1:
        achieved.append({"id": "first_paid", "name": "First Paid Brand Collaboration", "achieved": True})

    return achieved


@router.get("/upcoming-payments")
async def get_upcoming_payments(user: dict = Depends(get_current_user)):
    """Get upcoming payment reminders - includes all unpaid deals with due dates."""
    now = datetime.now(timezone.utc)

    deals = await db.deals.find(
        {"user_id": user["user_id"], "stage": {"$ne": "paid"}},
        {"_id": 0}
    ).to_list(1000)

    payments = []
    for deal in deals:
        if deal.get('payment_due_date'):
            due_date = datetime.fromisoformat(deal['payment_due_date'])
            if due_date.tzinfo is None:
                due_date = due_date.replace(tzinfo=timezone.utc)

            days_until = (due_date - now).days

            status = "upcoming"
            if days_until < 0:
                status = "overdue"
            elif days_until <= 3:
                status = "due_soon"

            payments.append({
                "deal_id": deal['deal_id'],
                "brand_name": deal['brand_name'],
                "amount": deal['deal_value'],
                "due_date": deal['payment_due_date'],
                "days_until": days_until,
                "status": status,
                "stage": deal.get('stage', 'lead')
            })

    payments.sort(key=lambda x: x['days_until'])
    return payments


@router.get("/cashflow")
async def get_cashflow_timeline(user: dict = Depends(get_current_user)):
    """Get cashflow timeline for next 4 weeks."""
    now = datetime.now(timezone.utc)

    deals = await db.deals.find(
        {"user_id": user["user_id"], "stage": {"$ne": "paid"}},
        {"_id": 0}
    ).to_list(1000)

    weeks = []
    for i in range(4):
        week_start = now + timedelta(weeks=i)
        week_end = week_start + timedelta(days=7)

        week_payments = sum(
            d['deal_value'] for d in deals
            if d.get('payment_due_date') and
            week_start <= datetime.fromisoformat(d['payment_due_date']).replace(tzinfo=timezone.utc) < week_end
        )

        weeks.append({
            "week": f"Week {i + 1}",
            "amount": week_payments
        })

    return weeks
