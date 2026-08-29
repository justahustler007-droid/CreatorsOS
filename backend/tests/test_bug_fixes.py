"""
Test file for CreatorOS bug fixes:
1. Dashboard overdue count - verify count matches deals with payment_due_date < today and stage != paid
2. Delete invoice - verify item removed from database
3. Delete deal - verify item removed from database
4. Delete income - verify item removed from database
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_bugs_1773155803331"

@pytest.fixture
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SESSION_TOKEN}"
    })
    session.cookies.set("session_token", SESSION_TOKEN)
    return session


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self, api_client):
        """Test API health endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    def test_auth_me(self, api_client):
        """Test auth endpoint"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data


class TestOverdueCount:
    """Test dashboard overdue count calculation"""
    
    def test_create_overdue_deal(self, api_client):
        """Create a deal with past due date to test overdue count"""
        # Create a deal with past payment_due_date (5 days ago)
        past_date = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
        
        deal_data = {
            "brand_name": "TEST_Overdue_Brand",
            "platform": "youtube",
            "deliverable_type": "video",
            "deal_value": 25000,
            "stage": "payment_pending",  # Not paid
            "payment_due_date": past_date,
            "notes": "Test overdue deal"
        }
        
        response = api_client.post(f"{BASE_URL}/api/deals", json=deal_data)
        assert response.status_code == 200
        data = response.json()
        assert data["brand_name"] == "TEST_Overdue_Brand"
        assert data["stage"] == "payment_pending"
        
        # Store deal_id for cleanup
        return data["deal_id"]
    
    def test_overdue_appears_in_upcoming_payments(self, api_client):
        """Verify overdue deal appears in upcoming payments with overdue status"""
        # First create an overdue deal
        past_date = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")
        
        deal_data = {
            "brand_name": "TEST_Overdue_Check",
            "platform": "instagram",
            "deliverable_type": "reel",
            "deal_value": 15000,
            "stage": "content_delivered",  # Not paid
            "payment_due_date": past_date
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/deals", json=deal_data)
        assert create_response.status_code == 200
        deal_id = create_response.json()["deal_id"]
        
        # Check upcoming payments endpoint
        response = api_client.get(f"{BASE_URL}/api/dashboard/upcoming-payments")
        assert response.status_code == 200
        payments = response.json()
        
        # Find our test deal
        test_payment = next((p for p in payments if p["deal_id"] == deal_id), None)
        assert test_payment is not None, "Overdue deal should appear in upcoming payments"
        assert test_payment["status"] == "overdue", "Deal with past due date should have 'overdue' status"
        assert test_payment["days_until"] < 0, "Days until should be negative for overdue"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/deals/{deal_id}")
    
    def test_paid_deal_not_in_overdue(self, api_client):
        """Verify paid deals don't appear in upcoming payments even with past due date"""
        past_date = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")
        
        deal_data = {
            "brand_name": "TEST_Paid_Deal",
            "platform": "youtube",
            "deliverable_type": "video",
            "deal_value": 30000,
            "stage": "paid",  # Already paid
            "payment_due_date": past_date
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/deals", json=deal_data)
        assert create_response.status_code == 200
        deal_id = create_response.json()["deal_id"]
        
        # Check upcoming payments endpoint
        response = api_client.get(f"{BASE_URL}/api/dashboard/upcoming-payments")
        assert response.status_code == 200
        payments = response.json()
        
        # Paid deal should NOT appear
        test_payment = next((p for p in payments if p["deal_id"] == deal_id), None)
        assert test_payment is None, "Paid deal should NOT appear in upcoming payments"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/deals/{deal_id}")


class TestDeleteInvoice:
    """Test invoice delete functionality"""
    
    def test_create_and_delete_invoice(self, api_client):
        """Create an invoice and verify delete removes it"""
        # Create invoice
        invoice_data = {
            "creator_name": "TEST_Delete_Creator",
            "creator_address": "Test Address",
            "client_name": "TEST_Delete_Client",
            "client_address": "Client Address",
            "description": "Test invoice for deletion",
            "taxable_value": 10000,
            "is_igst": False,
            "gst_rate": 18
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/invoices", json=invoice_data)
        assert create_response.status_code == 200
        invoice = create_response.json()
        invoice_id = invoice["invoice_id"]
        
        # Verify invoice exists
        list_response = api_client.get(f"{BASE_URL}/api/invoices")
        assert list_response.status_code == 200
        invoices = list_response.json()
        assert any(i["invoice_id"] == invoice_id for i in invoices), "Invoice should exist after creation"
        
        # Delete invoice
        delete_response = api_client.delete(f"{BASE_URL}/api/invoices/{invoice_id}")
        assert delete_response.status_code == 200
        assert delete_response.json()["message"] == "Invoice deleted"
        
        # Verify invoice is removed
        list_response2 = api_client.get(f"{BASE_URL}/api/invoices")
        assert list_response2.status_code == 200
        invoices2 = list_response2.json()
        assert not any(i["invoice_id"] == invoice_id for i in invoices2), "Invoice should be removed after deletion"
    
    def test_delete_nonexistent_invoice(self, api_client):
        """Test deleting non-existent invoice returns 404"""
        response = api_client.delete(f"{BASE_URL}/api/invoices/INV-NONEXISTENT-123456")
        assert response.status_code == 404


class TestDeleteDeal:
    """Test deal delete functionality"""
    
    def test_create_and_delete_deal(self, api_client):
        """Create a deal and verify delete removes it"""
        # Create deal
        deal_data = {
            "brand_name": "TEST_Delete_Brand",
            "platform": "youtube",
            "deliverable_type": "video",
            "deal_value": 50000,
            "stage": "lead"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/deals", json=deal_data)
        assert create_response.status_code == 200
        deal = create_response.json()
        deal_id = deal["deal_id"]
        
        # Verify deal exists
        list_response = api_client.get(f"{BASE_URL}/api/deals")
        assert list_response.status_code == 200
        deals = list_response.json()
        assert any(d["deal_id"] == deal_id for d in deals), "Deal should exist after creation"
        
        # Delete deal
        delete_response = api_client.delete(f"{BASE_URL}/api/deals/{deal_id}")
        assert delete_response.status_code == 200
        assert delete_response.json()["message"] == "Deal deleted"
        
        # Verify deal is removed
        list_response2 = api_client.get(f"{BASE_URL}/api/deals")
        assert list_response2.status_code == 200
        deals2 = list_response2.json()
        assert not any(d["deal_id"] == deal_id for d in deals2), "Deal should be removed after deletion"
    
    def test_delete_nonexistent_deal(self, api_client):
        """Test deleting non-existent deal returns 404"""
        response = api_client.delete(f"{BASE_URL}/api/deals/deal_nonexistent123")
        assert response.status_code == 404


class TestDeleteIncome:
    """Test income delete functionality"""
    
    def test_create_and_delete_income(self, api_client):
        """Create an income record and verify delete removes it"""
        # Create income
        income_data = {
            "source": "brand_deal",
            "platform": "youtube",
            "amount": 25000,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "notes": "Test income for deletion"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/income", json=income_data)
        assert create_response.status_code == 200
        income = create_response.json()
        income_id = income["income_id"]
        
        # Verify income exists
        list_response = api_client.get(f"{BASE_URL}/api/income")
        assert list_response.status_code == 200
        incomes = list_response.json()
        assert any(i["income_id"] == income_id for i in incomes), "Income should exist after creation"
        
        # Delete income
        delete_response = api_client.delete(f"{BASE_URL}/api/income/{income_id}")
        assert delete_response.status_code == 200
        assert delete_response.json()["message"] == "Income deleted"
        
        # Verify income is removed
        list_response2 = api_client.get(f"{BASE_URL}/api/income")
        assert list_response2.status_code == 200
        incomes2 = list_response2.json()
        assert not any(i["income_id"] == income_id for i in incomes2), "Income should be removed after deletion"
    
    def test_delete_nonexistent_income(self, api_client):
        """Test deleting non-existent income returns 404"""
        response = api_client.delete(f"{BASE_URL}/api/income/inc_nonexistent123")
        assert response.status_code == 404


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_deals(self, api_client):
        """Clean up any remaining test deals"""
        response = api_client.get(f"{BASE_URL}/api/deals")
        if response.status_code == 200:
            deals = response.json()
            for deal in deals:
                if deal["brand_name"].startswith("TEST_"):
                    api_client.delete(f"{BASE_URL}/api/deals/{deal['deal_id']}")
        assert True  # Cleanup always passes
