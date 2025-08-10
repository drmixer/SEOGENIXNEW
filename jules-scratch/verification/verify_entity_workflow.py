import re
import time
from playwright.sync_api import sync_playwright, Page, expect

def run_verification(page: Page):
    """
    This script verifies the end-to-end flow of running the entity analyzer,
    selecting missing entities, and switching to the content generator.
    It includes the full user signup (for a Pro plan) and onboarding flow.
    """
    # 1. Sign up a new user for a PRO plan
    unique_email = f"testuser_{int(time.time())}@example.com"
    password = "password123"

    print(f"Signing up with new user: {unique_email} for a Pro plan.")

    page.goto("http://localhost:5173/")

    pro_plan_card = page.locator(".border-purple-600")
    expect(pro_plan_card).to_be_visible(timeout=20000)
    pro_plan_card.get_by_role("button", name="Choose Plan").click()

    expect(page.get_by_role("heading", name="Create Account")).to_be_visible()
    expect(page.locator("div.font-medium.text-purple-600").get_by_text("Pro Plan")).to_be_visible()

    page.get_by_placeholder("Enter your full name").fill("Pro Test User")
    page.get_by_placeholder("Enter your email").fill(unique_email)
    page.get_by_placeholder("Enter your password").fill(password)
    page.get_by_role("button", name="Create Account").click()
    print("Signup form submitted for Pro plan.")

    # 2. Complete the multi-step onboarding process
    print("Starting onboarding...")
    expect(page.get_by_role("heading", name="Add Your Websites")).to_be_visible(timeout=20000)
    page.get_by_placeholder("https://example.com").fill("https://deno.land/")
    page.get_by_placeholder("My Website").fill("Deno Official")
    page.get_by_role("button", name="Next").click()
    print("Onboarding Step 1/4 complete.")

    expect(page.get_by_role("heading", name="Tell Us About Your Business")).to_be_visible()
    page.get_by_role("combobox").select_option("Technology & Software")
    page.get_by_role("button", name="Next").click()
    print("Onboarding Step 2/4 complete.")

    expect(page.get_by_role("heading", name="Add Your Competitors")).to_be_visible()
    page.get_by_placeholder("https://competitor.com").fill("https://nodejs.org/")
    page.get_by_placeholder("Competitor Name").fill("Node.js")
    page.get_by_role("button", name="Next").click()
    print("Onboarding Step 3/4 complete.")

    expect(page.get_by_role("heading", name="Set Your AI Visibility Goals")).to_be_visible()
    page.get_by_text("Increase AI Citations").click()
    page.get_by_role("button", name="Complete Setup").click()
    print("Onboarding Step 4/4 complete.")

    # 3. Land on Dashboard and skip walkthrough
    expect(page.get_by_text("Welcome to SEOGENIX!")).to_be_visible(timeout=20000)
    page.get_by_role("button", name="Skip").click()
    print("Onboarding complete, dashboard is visible.")

    # 4. Navigate to the Entity Coverage Analyzer tool
    expect(page.get_by_role("heading", name="Tools")).to_be_visible(timeout=15000)
    # Use force=True to click through the modal overlay
    page.get_by_text("Entity Coverage Analyzer", exact=True).first.click(force=True)

    # 5. Run the tool
    run_button = page.get_by_role("button", name="Run Entity Coverage Analyzer")
    expect(run_button).to_be_enabled()
    run_button.click()
    print("Entity Analyzer started...")

    # 6. Wait for results and select some entities
    expect(page.get_by_text("Actionable Missing Entities")).to_be_visible(timeout=30000)
    checkboxes = page.locator('input[type="checkbox"]')
    expect(checkboxes.first).to_be_visible()
    checkboxes.nth(0).check()
    checkboxes.nth(1).check()
    print("Selected 2 missing entities.")

    # 7. Click the "Generate Content" button
    generate_button = page.get_by_role("button", name=re.compile("Generate Content with .* Entities"))
    expect(generate_button).to_be_enabled()
    generate_button.click()
    print("Clicked 'Generate Content' button.")

    # 8. Verify that we have switched to the AI Content Generator tool
    expect(page.get_by_role("heading", name="AI Content Generator")).to_be_visible()
    print("Successfully switched to Content Generator.")

    # 9. Verify that the form is pre-filled
    topic_input = page.get_by_placeholder("e.g., AI Visibility, Content Optimization, Voice Search")
    keywords_input = page.get_by_placeholder("e.g., AI, SEO, optimization, visibility")
    expect(topic_input).to_have_value(re.compile("Content about deno.land"))
    expect(keywords_input).not_to_be_empty()
    print("Content Generator form is pre-filled correctly.")

    # 10. Take a screenshot for final verification
    page.screenshot(path="jules-scratch/verification/entity_workflow_verification.png")
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
