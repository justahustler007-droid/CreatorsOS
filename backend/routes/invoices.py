"""GST-compliant invoice endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from database import db
from deps import get_current_user
from models import Invoice, InvoiceCreate

router = APIRouter(tags=["invoices"])


@router.get("/invoices", response_model=List[dict])
async def get_invoices(user: dict = Depends(get_current_user)):
    """Get all invoices for current user."""
    invoices = await db.invoices.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return invoices


@router.post("/invoices")
async def create_invoice(invoice_data: InvoiceCreate, user: dict = Depends(get_current_user)):
    """Create a new GST-compliant invoice."""
    taxable = invoice_data.taxable_value

    if invoice_data.is_igst:
        igst_rate = 18.0
        igst_amount = round(taxable * igst_rate / 100, 2)
        cgst_amount = 0.0
        sgst_amount = 0.0
        cgst_rate = 0.0
        sgst_rate = 0.0
    else:
        cgst_rate = 9.0
        sgst_rate = 9.0
        cgst_amount = round(taxable * cgst_rate / 100, 2)
        sgst_amount = round(taxable * sgst_rate / 100, 2)
        igst_rate = 0.0
        igst_amount = 0.0

    total_tax = cgst_amount + sgst_amount + igst_amount
    total_amount = taxable + total_tax

    invoice = Invoice(
        user_id=user["user_id"],
        creator_name=invoice_data.creator_name,
        creator_address=invoice_data.creator_address,
        creator_gstin=invoice_data.creator_gstin,
        client_name=invoice_data.client_name,
        client_address=invoice_data.client_address,
        client_gstin=invoice_data.client_gstin,
        description=invoice_data.description,
        sac_code=invoice_data.sac_code,
        taxable_value=taxable,
        cgst_rate=cgst_rate,
        sgst_rate=sgst_rate,
        igst_rate=igst_rate,
        cgst_amount=cgst_amount,
        sgst_amount=sgst_amount,
        igst_amount=igst_amount,
        total_tax=total_tax,
        total_amount=total_amount
    )

    doc = invoice.model_dump()
    doc['invoice_date'] = doc['invoice_date'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()

    await db.invoices.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    """Delete an invoice."""
    result = await db.invoices.delete_one({"invoice_id": invoice_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice deleted"}
