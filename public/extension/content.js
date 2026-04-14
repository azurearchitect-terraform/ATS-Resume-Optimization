chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "autofill") {
    autofillForm(request.data);
    sendResponse({ success: true });
  }
});

function autofillForm(data) {
  console.log("ATS Autofill started with data:", data);

  const fillInput = (selectors, value) => {
    if (!value) return;
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && !el.value) {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  };

  // Common selectors for Workday, Greenhouse, Lever
  fillInput([
    'input[name="firstName"]', 'input[id="first_name"]', 'input[data-automation-id="legalNameSection_firstName"]', 'input[aria-label*="First Name"]'
  ], data.firstName);

  fillInput([
    'input[name="lastName"]', 'input[id="last_name"]', 'input[data-automation-id="legalNameSection_lastName"]', 'input[aria-label*="Last Name"]'
  ], data.lastName);

  fillInput([
    'input[name="email"]', 'input[id="email"]', 'input[data-automation-id="email"]', 'input[type="email"]'
  ], data.email);

  fillInput([
    'input[name="phone"]', 'input[id="phone"]', 'input[data-automation-id="phoneDevice"]', 'input[type="tel"]'
  ], data.phone);

  fillInput([
    'input[name="linkedin"]', 'input[id="job_application_answers_attributes_0_text_value"]', 'input[aria-label*="LinkedIn"]'
  ], data.linkedin);

  fillInput([
    'input[name="portfolio"]', 'input[name="website"]', 'input[aria-label*="Website"]'
  ], data.portfolio || data.github);

  // For Workday Experience/Education (Basic heuristic, as Workday is highly dynamic)
  // This is a simplified version. Real Workday autofill requires complex DOM traversal.
  console.log("Basic fields filled. Complex repeating fields (Experience/Education) may require manual copy-pasting or advanced selectors.");
}
