import re
import time
from playwright.sync_api import sync_playwright, Page, expect

def run_verification(page: Page):
    """
    This script verifies the end-to-end flow of running an audit,
    and then using the 'Fix it' button to switch to the content editor.
    """
    # 1. Sign up a new user to ensure a clean state
    unique_email = f"testuser_{int(time.time())}@example.com"
    password = "password123"

    print(f"Signing up with new user: {unique_email}")

    page.goto("http://localhost:5173/")

    # Wait for a stable element on the page to ensure it has loaded
    expect(page.get_by_role("heading", name="AI Visibility Starts Here")).to_be_visible(timeout=20000)
    print("Landing page loaded.")

    # Take a debug screenshot to see what the page looks like
    page.screenshot(path="jules-scratch/verification/debug_initial_page.png")
    print("Debug screenshot taken.")

    # Scroll to the pricing section to ensure the button is visible
    pricing_section = page.locator("#pricing")
    expect(pricing_section).to_be_attached(timeout=20000)
    pricing_section.scroll_into_view_if_needed()
    print("Scrolled to pricing section.")

    # Click the "Start Free" button in the pricing section
    page.get_by_role("button", name="Start Free").click()

    # The AuthModal should now be visible
    expect(page.get_by_role("heading", name="Create Account")).to_be_visible()

    # Fill out the form
    page.get_by_placeholder("Enter your full name").fill("Test User")
    page.get_by_placeholder("Enter your email").fill(unique_email)
    page.get_by_placeholder("Enter your password").fill(password)

    # Create the account
    page.get_by_role("button", name="Create Account").click()

    # Wait for the walkthrough to appear and skip it
    expect(page.get_by_text("Welcome to SEOGENIX!")).to_be_visible(timeout=20000)
    page.get_by_role("button", name="Skip").click()

    print("Signup and login successful. Navigated to dashboard.")

    # 2. Add a website to audit
    page.get_by_role("button", name="Add Website").click()
    expect(page.get_by_text("Manage Your Websites")).to_be_visible()
    page.get_by_placeholder("https://example.com").fill("https://google.com")
    page.get_by_role("button", name="Add Website").click()
    page.get_by_role("button", name="Close").click()

    print("Website added successfully.")

    # 3. Navigate to the AI Visibility Audit tool
    page.get_by_text("AI Visibility Audit", exact=True).first.click()

    # 4. Run the audit
    run_button = page.get_by_role("button", name="Run AI Visibility Audit")
    expect(run_button).to_be_enabled()
    run_button.click()

    print("Audit tool started...")

    # 5. Wait for results and find the "Fix it" button
    fix_it_button = page.get_by_role("button", name="Fix it")
    expect(fix_it_button).to_be_visible(timeout=30000)

    print("Audit complete. 'Fix it' button is visible.")

    # 6. Click the "Fix it" button
    fix_it_button.click()

    # 7. Verify that we have switched to the Content Editor
    expect(page.get_by_role("heading", name="Content Editor")).to_be_visible()

    print("Successfully switched to Content Editor.")

    # 8. Verify that the content has been loaded into the textarea
    textarea = page.locator("textarea")
    expect(textarea).to_contain_text("Google", timeout=15000)

    print("Content loaded into editor successfully.")

    # 9. Take a screenshot for final verification
    page.screenshot(path="jules-scratch/verification/verification.png")
    print("Screenshot taken.")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run_verification(page)
        except Exception as e:
            print(f"An error occurred: {e}")
            page.screenshot(path="jules-scratch/verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    main()
