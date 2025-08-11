import re
from playwright.sync_api import sync_playwright, expect
import time

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        print("Navigating to landing page...")
        page.goto("http://localhost:5173/")

        print("Waiting for landing page to load...")
        # Wait for the main heading to be visible
        heading = page.get_by_role("heading", name=re.compile("Unlock the Power of AI-Driven SEO"))
        expect(heading).to_be_visible(timeout=30000)

        print("Landing page loaded successfully.")
        page.screenshot(path="jules-scratch/verification/verification.png")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        browser.close()

with sync_playwright() as p:
    run_verification(p)
