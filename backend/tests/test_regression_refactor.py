"""
Regression test for CreatorOS backend after monolithic-to-modular refactor.
Validates all endpoints listed in routes/* still work with same API contract.
"""
import os
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_regression_2026"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SESSION_TOKEN}",
    })
    return s


# ----- Health & root -----
class TestHealth:
    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json()["message"] == "CreatorOS API"

    def test_health(self, api):
        r = api.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"


# ----- Auth & access -----
class TestAuth:
    def test_auth_me(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        body = r.json()
        assert body["user_id"] == "user_test_regression"
        assert body["email"] == "regression@test.com"

    def test_access_status(self, api):
        r = api.get(f"{BASE_URL}/api/auth/access-status")
        assert r.status_code == 200
        body = r.json()
        assert body["early_access"] is True
        assert "onboarding_complete" in body

    def test_unauthenticated_rejected(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


# ----- Profile -----
class TestProfile:
    def test_get_profile(self, api):
        r = api.get(f"{BASE_URL}/api/profile")
        assert r.status_code in (200, 404)

    def test_upsert_profile(self, api):
        payload = {
            "creator_name": "Regression Tester",
            "niche": "tech",
            "follower_count": 50000,
            "bio": "Test bio",
            "instagram_handle": "@reg_test",
        }
        r = api.post(f"{BASE_URL}/api/profile", json=payload)
        assert r.status_code == 200, r.text
        # Verify persistence
        g = api.get(f"{BASE_URL}/api/profile")
        assert g.status_code == 200
        body = g.json()
        assert body["niche"] == "tech"
        assert body["follower_count"] == 50000
        assert body["creator_name"] == "Regression Tester"


# ----- Income -----
class TestIncome:
    income_id = None

    def test_create_income(self, api):
        payload = {
            "source": "brand_deal",
            "platform": "youtube",
            "amount": 25000,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "notes": "TEST_regression_income",
        }
        r = api.post(f"{BASE_URL}/api/income", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["amount"] == 25000
        assert data["source"] == "brand_deal"
        assert "income_id" in data
        TestIncome.income_id = data["income_id"]

    def test_list_income(self, api):
        r = api.get(f"{BASE_URL}/api/income")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert any(i["income_id"] == TestIncome.income_id for i in items)

    def test_delete_income(self, api):
        r = api.delete(f"{BASE_URL}/api/income/{TestIncome.income_id}")
        assert r.status_code == 200
        # Verify deletion
        g = api.get(f"{BASE_URL}/api/income")
        assert not any(i["income_id"] == TestIncome.income_id for i in g.json())


# ----- Deals -----
class TestDeals:
    deal_id = None

    def test_create_deal(self, api):
        payload = {
            "brand_name": "TEST_RegressionBrand",
            "platform": "youtube",
            "deliverable_type": "video",
            "deal_value": 50000,
            "stage": "lead",
            "payment_due_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
            "notes": "Test deal",
        }
        r = api.post(f"{BASE_URL}/api/deals", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["brand_name"] == "TEST_RegressionBrand"
        assert data["deal_value"] == 50000
        TestDeals.deal_id = data["deal_id"]

    def test_list_deals(self, api):
        r = api.get(f"{BASE_URL}/api/deals")
        assert r.status_code == 200
        deals = r.json()
        assert any(d["deal_id"] == TestDeals.deal_id for d in deals)

    def test_pipeline(self, api):
        r = api.get(f"{BASE_URL}/api/deals/pipeline")
        assert r.status_code == 200
        body = r.json()
        # Pipeline should be a dict keyed by stage
        assert isinstance(body, (dict, list))

    def test_update_stage(self, api):
        r = api.put(
            f"{BASE_URL}/api/deals/{TestDeals.deal_id}/stage",
            json={"stage": "negotiating"},
        )
        assert r.status_code == 200, r.text
        # Verify
        deals = api.get(f"{BASE_URL}/api/deals").json()
        d = next(d for d in deals if d["deal_id"] == TestDeals.deal_id)
        assert d["stage"] == "negotiating"

    def test_invalid_stage_rejected(self, api):
        r = api.put(
            f"{BASE_URL}/api/deals/{TestDeals.deal_id}/stage",
            json={"stage": "not_a_real_stage"},
        )
        assert r.status_code == 400

    def test_update_deal(self, api):
        r = api.put(
            f"{BASE_URL}/api/deals/{TestDeals.deal_id}",
            json={"deal_value": 75000, "stage": "confirmed"},
        )
        assert r.status_code == 200, r.text
        deals = api.get(f"{BASE_URL}/api/deals").json()
        d = next(d for d in deals if d["deal_id"] == TestDeals.deal_id)
        assert d["deal_value"] == 75000
        assert d["stage"] == "confirmed"

    def test_delete_deal(self, api):
        r = api.delete(f"{BASE_URL}/api/deals/{TestDeals.deal_id}")
        assert r.status_code == 200
        deals = api.get(f"{BASE_URL}/api/deals").json()
        assert not any(d["deal_id"] == TestDeals.deal_id for d in deals)


# ----- Invoices -----
class TestInvoices:
    invoice_id = None

    def test_create_invoice_cgst_sgst(self, api):
        payload = {
            "creator_name": "TEST_Creator",
            "creator_address": "Bangalore, KA",
            "client_name": "TEST_Client",
            "client_address": "Bangalore, KA",
            "description": "Reg test invoice",
            "taxable_value": 10000,
            "is_igst": False,
            "gst_rate": 18,
        }
        r = api.post(f"{BASE_URL}/api/invoices", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["taxable_value"] == 10000
        # 18% split as 9% CGST + 9% SGST = 900 + 900 = 1800
        assert data["cgst_amount"] == 900.0
        assert data["sgst_amount"] == 900.0
        assert data["igst_amount"] == 0.0
        assert data["total_tax"] == 1800.0
        assert data["total_amount"] == 11800.0
        TestInvoices.invoice_id = data["invoice_id"]

    def test_create_invoice_igst(self, api):
        payload = {
            "creator_name": "TEST_Creator2",
            "creator_address": "Bangalore, KA",
            "client_name": "TEST_Client2",
            "client_address": "Mumbai, MH",
            "description": "Inter-state",
            "taxable_value": 50000,
            "is_igst": True,
            "gst_rate": 18,
        }
        r = api.post(f"{BASE_URL}/api/invoices", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["igst_amount"] == 9000.0
        assert data["total_amount"] == 59000.0
        # Cleanup
        api.delete(f"{BASE_URL}/api/invoices/{data['invoice_id']}")

    def test_list_invoices(self, api):
        r = api.get(f"{BASE_URL}/api/invoices")
        assert r.status_code == 200
        inv = r.json()
        assert any(i["invoice_id"] == TestInvoices.invoice_id for i in inv)

    def test_delete_invoice(self, api):
        r = api.delete(f"{BASE_URL}/api/invoices/{TestInvoices.invoice_id}")
        assert r.status_code == 200
        inv = api.get(f"{BASE_URL}/api/invoices").json()
        assert not any(i["invoice_id"] == TestInvoices.invoice_id for i in inv)


# ----- Content -----
class TestContent:
    content_id = None

    def test_create_content(self, api):
        payload = {
            "platform": "youtube",
            "content_type": "video",
            "views": 12000,
            "engagement_rate": 4.2,
            "revenue": 1500.0,
        }
        r = api.post(f"{BASE_URL}/api/content", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["platform"] == "youtube"
        assert data["views"] == 12000
        TestContent.content_id = data["content_id"]

    def test_list_content(self, api):
        r = api.get(f"{BASE_URL}/api/content")
        assert r.status_code == 200
        assert any(c["content_id"] == TestContent.content_id for c in r.json())

    def test_delete_content(self, api):
        r = api.delete(f"{BASE_URL}/api/content/{TestContent.content_id}")
        assert r.status_code == 200


# ----- Dashboard -----
class TestDashboard:
    def test_stats(self, api):
        r = api.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, dict)

    def test_insights(self, api):
        r = api.get(f"{BASE_URL}/api/dashboard/insights")
        assert r.status_code == 200

    def test_milestones(self, api):
        r = api.get(f"{BASE_URL}/api/dashboard/milestones")
        assert r.status_code == 200

    def test_upcoming_payments(self, api):
        r = api.get(f"{BASE_URL}/api/dashboard/upcoming-payments")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_cashflow(self, api):
        r = api.get(f"{BASE_URL}/api/dashboard/cashflow")
        assert r.status_code == 200


# ----- AI -----
class TestAI:
    def test_pricing_suggestion(self, api):
        payload = {
            "platform": "youtube",
            "content_type": "video",
            "follower_count": 50000,
            "engagement_rate": 4.5,
        }
        r = api.post(f"{BASE_URL}/api/ai/pricing-suggestion", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, dict)
        assert len(body) > 0
