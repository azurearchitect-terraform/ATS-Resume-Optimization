document.getElementById('autofillBtn').addEventListener('click', async () => {
  const payloadStr = document.getElementById('payload').value;
  const statusEl = document.getElementById('status');
  
  if (!payloadStr) {
    statusEl.textContent = "Please paste the JSON payload first.";
    statusEl.style.color = "red";
    return;
  }

  try {
    const data = JSON.parse(payloadStr);
    
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send message to content script
    chrome.tabs.sendMessage(tab.id, { action: "autofill", data: data }, (response) => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = "Error: Refresh the page and try again.";
        statusEl.style.color = "red";
      } else {
        statusEl.textContent = "Autofill command sent!";
        statusEl.style.color = "green";
      }
    });
  } catch (e) {
    statusEl.textContent = "Invalid JSON format.";
    statusEl.style.color = "red";
  }
});
