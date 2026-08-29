# CreatorOS Email Templates

Premium, mobile-first HTML emails for CreatorOS. Built as **drop-in templates**
(not wired to any provider yet) so you can plug Resend, SendGrid, Postmark, or
SES in without rewriting copy.

## Design system

- **Container:** 600 px max, `Manrope` / `system-ui` stack
- **Brand gradient:** `linear-gradient(135deg, #6366F1 → #EC4899)` (the same
  violet→fuchsia used across the app)
- **Background:** `#0B0F1A` (dark) and `#FAFAFA` (light fallback)
- **Tone:** balanced — mostly calm, occasional insight nudge. Never address
  the creator by first name in the subject; subject lines must be < 60 chars.

## Token replacement

Tokens use double-curly Mustache style: `{{ creator_name }}`, `{{ brand_name }}`.
Replace them on the server (Jinja2 `Template(html).render(**ctx)` works out of
the box) before sending.

## Templates included

| File                          | Trigger                          |
|------------------------------ |--------------------------------- |
| `collab_request.html`         | New collab request received      |
| `outreach_replied.html`       | A brand replied to your pitch    |
| `weekly_digest.html`          | Sunday morning recap             |

All templates share `_base.html` (head + footer) — keep edits in `_base.html`
to keep the visual system consistent.

## When you're ready to wire a provider

1. `pip install resend` (or `sendgrid`)
2. Add `RESEND_API_KEY` to `backend/.env`
3. In `services/notification_service.py`, after `db.notifications.insert_one(doc)`,
   look up the user's email + a per-type preference flag, render the matching
   template, and call `resend.Emails.send(...)`.
