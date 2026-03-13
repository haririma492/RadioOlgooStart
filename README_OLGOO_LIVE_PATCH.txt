Olgoo Live integration patch
===========================

This zip contains only new files and changed files.

What it adds
------------
1. Public Olgoo Live banner on the homepage.
2. Public state endpoint: /api/olgoo-live/state
3. Private support page: /TVsupport
4. Private control endpoint: /api/olgoo-live/control
5. Floating player support for iframe/video modes.

Environment variables
---------------------
Required for control page auth:
- ADMIN_TOKEN

Optional public fallback for demo/testing without Python:
- OLGOO_LIVE_FALLBACK_URL
- OLGOO_LIVE_FALLBACK_TITLE
- OLGOO_LIVE_FALLBACK_PLAYER_TYPE   (video or iframe)

Optional Python backend integration:
- OLGOO_LIVE_PYTHON_STATE_URL
- OLGOO_LIVE_PYTHON_CONTROL_URL
- OLGOO_LIVE_INTERNAL_TOKEN

Suggested next step
-------------------
Point the two OLGOO_LIVE_PYTHON_* URLs to your Python backend.
The public site will call /api/olgoo-live/state only.
The /TVsupport page will call /api/olgoo-live/control only.
