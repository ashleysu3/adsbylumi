"""End-to-end publish-flow test against the local dev server.

Walks: seed fixture -> open campaign builder -> QA checks -> click Publish to Meta
-> assert the UI leaves the QA screen and reports a result.

Safe by construction: the fixture publishes with qaTestMode, so the campaign is
created PAUSED on the real ad account and named with a [QA] prefix. Run
cleanup.py afterwards to remove it.

Usage:
    python3 tests/e2e/publish_flow.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from lumi_e2e import (  # noqa: E402
    BASE_URL,
    SCREENSHOTS,
    auth_status,
    call_function,
    collect_console,
    restore_session,
)
from playwright.async_api import async_playwright  # noqa: E402

FAILURES: list[str] = []


def check(label: str, condition: bool, detail: str = ""):
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {label}{(' — ' + detail) if detail else ''}")
    if not condition:
        FAILURES.append(f"{label}{(' — ' + detail) if detail else ''}")


async def main():
    print(f"auth status: {auth_status()}")
    if auth_status() != "injected":
        print("No session injected — sign in to the Lovable preview, then re-run.")
        return 2

    print("\n1. Seeding QA fixture...")
    seed = call_function("qa-harness", {"action": "seed"})
    if not seed.get("success"):
        print(f"   seed failed: {seed.get('error')}")
        return 2
    workspace_id = seed["workspaceId"]
    print(f"   workspace {workspace_id} (brand {seed['brandId']})")
    print(f"   Meta creds borrowed from: {seed['borrowedFrom']['brandName']}")

    console: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        collect_console(page, console)

        await restore_session(context, page)

        print("\n2. Opening the campaign builder...")
        await page.goto(
            f"{BASE_URL}/campaign-builder?workspace={workspace_id}",
            wait_until="domcontentloaded",
        )
        await page.wait_for_timeout(4000)
        await page.screenshot(path=str(SCREENSHOTS / "1_builder.png"))

        on_signin = "/auth" in page.url
        check("Builder loads without bouncing to sign-in", not on_signin, page.url)
        if on_signin:
            await browser.close()
            return 1

        print("\n3. Looking for the publish control...")
        publish = page.get_by_role("button", name="Publish to Meta")
        found = await publish.count() > 0
        check("'Publish to Meta' button is present", found)

        if found:
            enabled = await publish.first.is_enabled()
            check("Publish button is enabled", enabled)

            await publish.first.click()
            # The click must produce visible feedback within 3s — this is the
            # exact regression Holly hit (click, nothing happens).
            await page.wait_for_timeout(3000)
            await page.screenshot(path=str(SCREENSHOTS / "2_after_click.png"))

            body = (await page.locator("body").inner_text()).lower()
            reacted = any(
                token in body
                for token in ["publishing", "building your campaign", "error", "failed", "live"]
            )
            check(
                "Clicking publish produces visible feedback (never silent)",
                reacted,
                "no state change detected in 3s",
            )

            print("\n4. Waiting for the publish to settle (up to 3 min)...")
            settled = False
            for _ in range(36):
                await page.wait_for_timeout(5000)
                body = (await page.locator("body").inner_text()).lower()
                if any(t in body for t in ["your campaign is live", "campaign published", "paused", "error", "failed", "try again"]):
                    settled = True
                    break
            await page.screenshot(path=str(SCREENSHOTS / "3_result.png"))
            check("Publish reaches a terminal state (success or visible error)", settled)

        errors = [c for c in console if c.startswith("[pageerror]") or "[error]" in c]
        check("No uncaught page errors", len(errors) == 0, "; ".join(errors[:3]))

        await browser.close()

    print("\n5. Verifying on Meta...")
    status = call_function("qa-harness", {"action": "status"})
    for ws in status.get("workspaces", []):
        print(f"   {ws['name']}: {ws.get('meta_campaign_status')} ids={ws.get('meta_campaign_ids')}")
    check(
        "Fixture workspace recorded a Meta campaign",
        any(w.get("meta_campaign_ids") for w in status.get("workspaces", [])),
    )

    print("\n" + "=" * 60)
    if FAILURES:
        print(f"{len(FAILURES)} FAILURE(S):")
        for f in FAILURES:
            print(f"  - {f}")
    else:
        print("All checks passed.")
    print(f"Screenshots: {SCREENSHOTS}")
    print("Open Ads Manager and confirm the [QA] campaign is PAUSED with the right")
    print("budget, placements, creative and pixel. Then run: python3 tests/e2e/cleanup.py")
    print("=" * 60)
    return 1 if FAILURES else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
