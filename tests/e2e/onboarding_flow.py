"""End-to-end onboarding + creative test.

Walks the anonymous "see your ad before you sign up" flow to make sure a new
visitor never lands on the sign-in page and reaches a generated ad.

Usage:
    python3 tests/e2e/onboarding_flow.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from lumi_e2e import BASE_URL, SCREENSHOTS, collect_console  # noqa: E402
from playwright.async_api import async_playwright  # noqa: E402

FAILURES: list[str] = []


def check(label: str, condition: bool, detail: str = ""):
    print(f"  [{'PASS' if condition else 'FAIL'}] {label}{(' — ' + detail) if detail else ''}")
    if not condition:
        FAILURES.append(label)


async def main():
    console: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        # Fresh context, no session — this is a brand new visitor.
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        collect_console(page, console)

        print("1. Landing on the homepage as an anonymous visitor...")
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        await page.screenshot(path=str(SCREENSHOTS / "onb_1_home.png"))

        url_input = page.locator("input[type='url'], input[placeholder*='website' i], input[placeholder*='.com' i]")
        has_input = await url_input.count() > 0
        check("Homepage exposes a website capture field", has_input)

        if has_input:
            await url_input.first.fill("https://adsbylumi.com")
            await url_input.first.press("Enter")
            await page.wait_for_timeout(6000)
            await page.screenshot(path=str(SCREENSHOTS / "onb_2_after_submit.png"))

            check("Visitor is not bounced to sign-in", "/auth" not in page.url, page.url)
            check("Visitor lands in onboarding", "/onboarding" in page.url, page.url)

            body = (await page.locator("body").inner_text()).lower()
            check(
                "Website is not re-requested",
                "drop your website" not in body,
                "onboarding asked for the URL again",
            )

            print("2. Waiting for extraction / ad generation (up to 2 min)...")
            reached = False
            for _ in range(24):
                await page.wait_for_timeout(5000)
                body = (await page.locator("body").inner_text()).lower()
                if "/auth" in page.url:
                    break
                if any(t in body for t in ["your ad", "here's your", "start free trial", "your first ad"]):
                    reached = True
                    break
            await page.screenshot(path=str(SCREENSHOTS / "onb_3_payoff.png"))
            check("Reaches the generated-ad screen before any paywall", reached)
            check("Still never hit the sign-in page", "/auth" not in page.url, page.url)

        errors = [c for c in console if c.startswith("[pageerror]")]
        check("No uncaught page errors", len(errors) == 0, "; ".join(errors[:3]))

        await browser.close()

    print("\n" + "=" * 60)
    if FAILURES:
        print(f"{len(FAILURES)} FAILURE(S):")
        for f in FAILURES:
            print(f"  - {f}")
    else:
        print("All checks passed.")
    print(f"Screenshots: {SCREENSHOTS}")
    print("=" * 60)
    return 1 if FAILURES else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
