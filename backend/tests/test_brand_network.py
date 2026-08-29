"""Phase 2 regression: Brand Finder + Outreach + Network endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://creatoros-beta.preview.emergentagent.com").rstrip("/")
TOKEN = "test_session_regression_2026"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


# ─── BRANDS ─────────────────────────────────────────────────────
class TestBrands:
    def test_list_brands(self, session):
        r = session.get(f"{BASE_URL}/api/brands")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list) and len(data) >= 28
        b0 = data[0]
        for k in ("brand_id", "name", "match_score", "saved"):
            assert k in b0, f"missing {k}: {b0.keys()}"

    def test_meta_filters(self, session):
        r = session.get(f"{BASE_URL}/api/brands/meta/filters")
        assert r.status_code == 200
        j = r.json()
        assert "categories" in j and "regions" in j
        assert len(j["categories"]) > 0 and len(j["regions"]) > 0

    def test_single_brand(self, session):
        r = session.get(f"{BASE_URL}/api/brands")
        bid = r.json()[0]["brand_id"]
        r = session.get(f"{BASE_URL}/api/brands/{bid}")
        assert r.status_code == 200
        assert r.json()["brand_id"] == bid

    def test_save_and_list_and_unsave(self, session):
        bid = session.get(f"{BASE_URL}/api/brands").json()[0]["brand_id"]
        # Ensure clean state
        session.delete(f"{BASE_URL}/api/brands/save/{bid}")

        r = session.post(f"{BASE_URL}/api/brands/save", json={"brand_id": bid})
        assert r.status_code == 200 and r.json()["saved"] is True

        r = session.get(f"{BASE_URL}/api/brands/saved/list")
        assert r.status_code == 200
        assert any(b["brand_id"] == bid for b in r.json())

        r = session.delete(f"{BASE_URL}/api/brands/save/{bid}")
        assert r.status_code == 200 and r.json()["saved"] is False

        r = session.get(f"{BASE_URL}/api/brands/saved/list")
        assert not any(b["brand_id"] == bid for b in r.json())

    def test_save_invalid_brand(self, session):
        r = session.post(f"{BASE_URL}/api/brands/save", json={"brand_id": "nope_xxx"})
        assert r.status_code == 404


# ─── AI PITCH ─────────────────────────────────────────────────────
class TestAiPitch:
    def test_generate_pitch(self, session):
        bid = session.get(f"{BASE_URL}/api/brands").json()[0]["brand_id"]
        r = session.post(f"{BASE_URL}/api/ai/generate-pitch", json={"brand_id": bid}, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "subject" in j and "body" in j
        assert len(j["subject"]) > 0 and len(j["body"]) > 0

    def test_generate_pitch_missing_id(self, session):
        r = session.post(f"{BASE_URL}/api/ai/generate-pitch", json={})
        assert r.status_code == 400


# ─── OUTREACH ─────────────────────────────────────────────────────
class TestOutreach:
    outreach_id = None

    def test_create(self, session):
        bid = session.get(f"{BASE_URL}/api/brands").json()[0]["brand_id"]
        r = session.post(f"{BASE_URL}/api/outreach", json={
            "brand_id": bid,
            "subject": "TEST_subject",
            "body": "TEST_body content",
            "estimated_value": 50000,
        })
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "pending"
        assert j["subject"] == "TEST_subject"
        assert j["estimated_value"] == 50000
        TestOutreach.outreach_id = j["outreach_id"]

    def test_pipeline(self, session):
        r = session.get(f"{BASE_URL}/api/outreach/pipeline")
        assert r.status_code == 200
        j = r.json()
        for status in ("pending", "sent", "viewed", "replied", "negotiating", "closed_won", "closed_lost"):
            assert status in j, f"missing status column: {status}"
        assert any(o["outreach_id"] == TestOutreach.outreach_id for o in j["pending"])

    def test_stats(self, session):
        r = session.get(f"{BASE_URL}/api/outreach/stats")
        assert r.status_code == 200
        j = r.json()
        assert "total" in j and "by_status" in j and "response_rate" in j and "pipeline_value" in j

    @pytest.mark.parametrize("status", ["sent", "viewed", "replied", "negotiating", "closed_won"])
    def test_status_transitions(self, session, status):
        oid = TestOutreach.outreach_id
        assert oid
        r = session.put(f"{BASE_URL}/api/outreach/{oid}/status", json={"status": status})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == status

    def test_invalid_status(self, session):
        oid = TestOutreach.outreach_id
        r = session.put(f"{BASE_URL}/api/outreach/{oid}/status", json={"status": "bogus"})
        assert r.status_code in (400, 422)

    def test_delete(self, session):
        oid = TestOutreach.outreach_id
        r = session.delete(f"{BASE_URL}/api/outreach/{oid}")
        assert r.status_code == 200
        r = session.delete(f"{BASE_URL}/api/outreach/{oid}")
        assert r.status_code == 404


# ─── NETWORK ─────────────────────────────────────────────────────
class TestNetwork:
    request_id = None
    demo_target = None

    def test_get_discoverable(self, session):
        r = session.get(f"{BASE_URL}/api/network/me/discoverable")
        assert r.status_code == 200
        assert "discoverable" in r.json()

    def test_toggle_discoverable(self, session):
        r = session.post(f"{BASE_URL}/api/network/discoverable?enabled=true")
        assert r.status_code == 200 and r.json()["discoverable"] is True
        r = session.get(f"{BASE_URL}/api/network/me/discoverable")
        assert r.json()["discoverable"] is True

    def test_discover(self, session):
        r = session.get(f"{BASE_URL}/api/network/discover")
        assert r.status_code == 200
        creators = r.json()
        assert isinstance(creators, list)
        # at least 10 demo creators expected
        demos = [c for c in creators if str(c.get("user_id", "")).startswith("demo_")]
        assert len(demos) >= 10, f"Expected 10+ demo creators, got {len(demos)}"
        # excludes current user
        assert all(c["user_id"] != "user_test_regression" for c in creators)
        # required fields
        c0 = demos[0]
        for k in ("compatibility", "follower_count", "fake_follower_risk", "gradient"):
            assert k in c0
        TestNetwork.demo_target = demos[0]["user_id"]

    def test_discover_sort_followers(self, session):
        r = session.get(f"{BASE_URL}/api/network/discover?sort=followers")
        assert r.status_code == 200
        items = r.json()
        if len(items) >= 2:
            assert items[0]["follower_count"] >= items[-1]["follower_count"]

    def test_send_request(self, session):
        target = TestNetwork.demo_target
        # cleanup any prior pending
        out = session.get(f"{BASE_URL}/api/network/requests/outgoing").json()
        for r_ in out:
            if r_["to_user_id"] == target and r_["status"] in ("pending", "accepted"):
                session.put(f"{BASE_URL}/api/network/requests/{r_['request_id']}", json={"status": "cancelled"})

        r = session.post(f"{BASE_URL}/api/network/requests", json={
            "to_user_id": target,
            "message": "TEST_collab message"
        })
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "pending"
        assert j["to_user_id"] == target
        TestNetwork.request_id = j["request_id"]

    def test_duplicate_blocked(self, session):
        r = session.post(f"{BASE_URL}/api/network/requests", json={
            "to_user_id": TestNetwork.demo_target,
            "message": "dup"
        })
        assert r.status_code == 409

    def test_self_request_blocked(self, session):
        r = session.post(f"{BASE_URL}/api/network/requests", json={
            "to_user_id": "user_test_regression",
            "message": "self"
        })
        assert r.status_code == 400

    def test_outgoing_list(self, session):
        r = session.get(f"{BASE_URL}/api/network/requests/outgoing")
        assert r.status_code == 200
        items = r.json()
        assert any(i["request_id"] == TestNetwork.request_id for i in items)
        match = next(i for i in items if i["request_id"] == TestNetwork.request_id)
        assert "other_creator" in match
        assert match["other_creator"]["user_id"] == TestNetwork.demo_target

    def test_incoming_list(self, session):
        r = session.get(f"{BASE_URL}/api/network/requests/incoming")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_accept_forbidden_for_sender(self, session):
        # Sender tries to accept own request -> forbidden
        r = session.put(f"{BASE_URL}/api/network/requests/{TestNetwork.request_id}",
                        json={"status": "accepted"})
        assert r.status_code == 403

    def test_cancel_own(self, session):
        r = session.put(f"{BASE_URL}/api/network/requests/{TestNetwork.request_id}",
                        json={"status": "cancelled"})
        assert r.status_code == 200

    def test_connections(self, session):
        r = session.get(f"{BASE_URL}/api/network/connections")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_stats(self, session):
        r = session.get(f"{BASE_URL}/api/network/stats")
        assert r.status_code == 200
        j = r.json()
        for k in ("incoming_pending", "sent_total", "connections"):
            assert k in j and isinstance(j[k], int)
