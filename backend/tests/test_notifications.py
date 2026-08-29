"""Notification Center end-to-end tests (Phase 5).

Covers: CRUD endpoints + outreach status triggers + weekly digest builder.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://creatoros-beta.preview.emergentagent.com").rstrip("/")
TOKEN = "test_session_regression_2026"
USER_ID = "user_test_regression"

HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


@pytest.fixture(scope="module")
def cleanup_after(session):
    yield
    # Final cleanup: clear all read
    session.delete(f"{API}/notifications", params={"only_read": True})


# ─── CRUD ──────────────────────────────────────────────────────────────────
class TestNotificationCRUD:
    def test_list_notifications(self, session):
        r = session.get(f"{API}/notifications")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Verify required fields when present
        for n in data:
            assert "notification_id" in n
            assert "user_id" in n
            assert n["user_id"] == USER_ID
            assert "type" in n
            assert "category" in n
            assert "title" in n
            assert "body" in n
            assert "priority" in n
            assert "read" in n
            assert "created_at" in n
            assert "_id" not in n  # MongoDB _id excluded

    def test_list_with_unread_filter(self, session):
        r = session.get(f"{API}/notifications", params={"unread_only": True})
        assert r.status_code == 200
        for n in r.json():
            assert n["read"] is False

    def test_list_with_category_filter(self, session):
        r = session.get(f"{API}/notifications", params={"category": "outreach"})
        assert r.status_code == 200
        for n in r.json():
            assert n["category"] == "outreach"

    def test_list_with_limit(self, session):
        r = session.get(f"{API}/notifications", params={"limit": 2})
        assert r.status_code == 200
        assert len(r.json()) <= 2

    def test_unread_count(self, session):
        r = session.get(f"{API}/notifications/unread-count")
        assert r.status_code == 200
        data = r.json()
        assert "total" in data
        assert "by_category" in data
        assert isinstance(data["total"], int)
        assert isinstance(data["by_category"], dict)

    def test_mark_read_invalid_id(self, session):
        r = session.post(f"{API}/notifications/ntf_nonexistent_xyz/read")
        assert r.status_code == 404

    def test_delete_invalid_id(self, session):
        r = session.delete(f"{API}/notifications/ntf_nonexistent_xyz")
        assert r.status_code == 404


# ─── OUTREACH TRIGGERS ────────────────────────────────────────────────────
class TestOutreachNotificationTriggers:
    @pytest.fixture(scope="class")
    def outreach_id(self, session):
        # Create a brand outreach for testing
        brands_r = session.get(f"{API}/brands")
        assert brands_r.status_code == 200
        brand = brands_r.json()[0]
        r = session.post(f"{API}/outreach", json={
            "brand_id": brand["brand_id"],
            "subject": "TEST_NOTIFICATIONS",
            "body": "Test pitch for notification triggers.",
            "estimated_value": 50000,
        })
        assert r.status_code == 200
        oid = r.json()["outreach_id"]
        yield oid
        # Cleanup
        session.delete(f"{API}/outreach/{oid}")

    def _delete_notifications_of_type(self, session, ntype):
        """Delete all existing notifications of this type to clear dedupe window."""
        items = session.get(f"{API}/notifications", params={"limit": 100}).json()
        for n in items:
            if n["type"] == ntype:
                session.delete(f"{API}/notifications/{n['notification_id']}")

    def _has_notification_of_type(self, session, ntype):
        r = session.get(f"{API}/notifications", params={"limit": 100})
        return any(n["type"] == ntype for n in r.json())

    def test_status_viewed_creates_notification(self, session, outreach_id):
        self._delete_notifications_of_type(session, "outreach_viewed")
        r = session.put(f"{API}/outreach/{outreach_id}/status", json={"status": "viewed"})
        assert r.status_code == 200
        time.sleep(0.5)
        assert self._has_notification_of_type(session, "outreach_viewed"), "viewed notification not created"

    def test_status_replied_creates_notification(self, session, outreach_id):
        self._delete_notifications_of_type(session, "outreach_replied")
        r = session.put(f"{API}/outreach/{outreach_id}/status", json={"status": "replied"})
        assert r.status_code == 200
        time.sleep(0.5)
        assert self._has_notification_of_type(session, "outreach_replied")

    def test_status_negotiating_creates_notification(self, session, outreach_id):
        self._delete_notifications_of_type(session, "outreach_negotiating")
        r = session.put(f"{API}/outreach/{outreach_id}/status", json={"status": "negotiating"})
        assert r.status_code == 200
        time.sleep(0.5)
        assert self._has_notification_of_type(session, "outreach_negotiating")

    def test_status_closed_won_creates_notification(self, session, outreach_id):
        self._delete_notifications_of_type(session, "outreach_won")
        r = session.put(f"{API}/outreach/{outreach_id}/status", json={"status": "closed_won"})
        assert r.status_code == 200
        time.sleep(0.5)
        assert self._has_notification_of_type(session, "outreach_won")
        # Verify body contains the value label
        items = session.get(f"{API}/notifications", params={"limit": 10}).json()
        won = next((n for n in items if n["type"] == "outreach_won"), None)
        assert won is not None
        assert "50,000" in won["body"] or "₹" in won["body"]
        # Verify body contains the value label
        items = session.get(f"{API}/notifications", params={"limit": 10}).json()
        won = next((n for n in items if n["type"] == "outreach_won"), None)
        assert won is not None
        assert "50,000" in won["body"] or "₹" in won["body"]

    def test_status_no_op_does_not_duplicate(self, session, outreach_id):
        # Setting the same status again should NOT create a new notification (dedupe + same-status check)
        # Outreach status is currently 'closed_won' after prior test
        items_before = session.get(f"{API}/notifications", params={"limit": 100}).json()
        before = sum(1 for n in items_before if n["type"] == "outreach_won")
        r = session.put(f"{API}/outreach/{outreach_id}/status", json={"status": "closed_won"})
        assert r.status_code == 200
        time.sleep(0.5)
        items_after = session.get(f"{API}/notifications", params={"limit": 100}).json()
        after = sum(1 for n in items_after if n["type"] == "outreach_won")
        assert after == before, "Repeat status transition should not create duplicate notification"


# ─── WEEKLY DIGEST ────────────────────────────────────────────────────────
class TestWeeklyDigest:
    def test_weekly_digest_dedupe(self, session):
        # First call may create or be a no-op (if seeded); second call must be no-op
        r1 = session.post(f"{API}/notifications/digest/weekly")
        assert r1.status_code == 200
        d1 = r1.json()
        assert "created" in d1
        # Second call should always be deduped (6-day window)
        r2 = session.post(f"{API}/notifications/digest/weekly")
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["created"] is False
        assert d2.get("reason") == "already_sent_this_week"

    def test_digest_body_contains_stats_labels(self, session):
        items = session.get(f"{API}/notifications", params={"category": "insights", "limit": 10}).json()
        digest = next((n for n in items if n["type"] == "weekly_digest"), None)
        assert digest is not None, "No weekly_digest notification found"
        body = digest["body"]
        assert "pitches sent" in body
        assert "replies" in body
        assert "new connections" in body
        assert "earned" in body
        # Title should be the standard one
        assert digest["title"] == "Your week in numbers"


# ─── BULK / MARK READ ─────────────────────────────────────────────────────
class TestBulkActions:
    def test_mark_single_read(self, session):
        # Need an unread notification
        unread = session.get(f"{API}/notifications", params={"unread_only": True, "limit": 1}).json()
        if not unread:
            pytest.skip("No unread notifications to test mark_read")
        nid = unread[0]["notification_id"]
        r = session.post(f"{API}/notifications/{nid}/read")
        assert r.status_code == 200
        assert r.json()["read"] is True
        # Verify persisted
        items = session.get(f"{API}/notifications").json()
        found = next((n for n in items if n["notification_id"] == nid), None)
        assert found is not None
        assert found["read"] is True

    def test_read_bulk(self, session):
        # Get any unread; if none, create via outreach (already done above)
        unread = session.get(f"{API}/notifications", params={"unread_only": True, "limit": 5}).json()
        if not unread:
            pytest.skip("No unread to bulk-read")
        ids = [n["notification_id"] for n in unread]
        r = session.post(f"{API}/notifications/read-bulk", json={"notification_ids": ids})
        assert r.status_code == 200
        assert r.json()["updated"] >= 0

    def test_read_bulk_empty(self, session):
        r = session.post(f"{API}/notifications/read-bulk", json={"notification_ids": []})
        assert r.status_code == 200
        assert r.json()["updated"] == 0

    def test_mark_all_read(self, session):
        r = session.post(f"{API}/notifications/read-all")
        assert r.status_code == 200
        # Verify unread is 0
        cnt = session.get(f"{API}/notifications/unread-count").json()
        assert cnt["total"] == 0

    def test_clear_read_notifications(self, session):
        # All are read after previous test; clear them
        before_count = len(session.get(f"{API}/notifications", params={"limit": 100}).json())
        r = session.delete(f"{API}/notifications", params={"only_read": True})
        assert r.status_code == 200
        assert "deleted" in r.json()
        after_count = len(session.get(f"{API}/notifications", params={"limit": 100}).json())
        assert after_count <= before_count


# ─── NETWORK TRIGGERS (verify side effect on recipient) ───────────────────
class TestNetworkTriggers:
    """Test that collab actions create notifications. Since test user is the
    SENDER, the recipient (a demo_*) gets the notification. We verify via DB-shape
    by sending to a demo creator and then having the test user check that the
    SENT request exists (notification is on recipient side, which we cannot
    easily query without their token). So we instead verify the FLOW completes
    without 500, and the accept-flow is verified indirectly by checking we
    can create+cancel without errors.
    """
    def test_create_collab_to_demo_creator(self, session):
        # Find a demo creator
        creators = session.get(f"{API}/network/discover").json()
        demo = next((c for c in creators if c["user_id"].startswith("demo_")), None)
        if not demo:
            pytest.skip("No demo creator available")

        # Cancel any existing request to this demo creator first
        outgoing = session.get(f"{API}/network/requests/outgoing").json()
        existing = next((r for r in outgoing if r["to_user_id"] == demo["user_id"] and r["status"] in ("pending", "accepted")), None)
        if existing:
            session.put(f"{API}/network/requests/{existing['request_id']}", json={"status": "cancelled"})

        r = session.post(f"{API}/network/requests", json={
            "to_user_id": demo["user_id"],
            "message": "TEST_NOTIF: Collab notification trigger test",
        })
        assert r.status_code in (200, 201), f"Failed: {r.status_code} {r.text}"
        req_id = r.json()["request_id"]

        # Cancel it (creates cancelled notification for recipient)
        r2 = session.put(f"{API}/network/requests/{req_id}", json={"status": "cancelled"})
        assert r2.status_code == 200
