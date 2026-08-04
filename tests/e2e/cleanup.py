"""Delete the QA fixture and every [QA]-prefixed campaign on the connected ad account.

Usage:
    python3 tests/e2e/cleanup.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from lumi_e2e import auth_status, call_function  # noqa: E402

if auth_status() != "injected":
    print("No session injected — sign in to the Lovable preview, then re-run.")
    raise SystemExit(2)

res = call_function("qa-harness", {"action": "cleanup"})
if not res.get("success"):
    print(f"Cleanup failed: {res.get('error')}")
    raise SystemExit(1)

removed = res.get("removed", {})
print(f"Deleted {len(removed.get('campaigns', []))} [QA] campaign(s) on Meta:")
for c in removed.get("campaigns", []):
    print(f"  - {c}")
print(f"Deleted {removed.get('workspaces', 0)} fixture workspace(s) and the QA brand.")
for f in removed.get("failures", []):
    print(f"  ! {f}")
