// Calls the Google Apps Script web app. Using Content-Type: text/plain keeps
// this a "simple request" so the browser does NOT send a CORS preflight
// (Apps Script web apps don't handle OPTIONS requests, so a preflight would
// fail). Apps Script still reads the JSON fine from e.postData.contents.
async function callAppsScript(payload) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf("PASTE_YOUR_WEB_APP_URL_HERE") !== -1) {
    throw new Error("The site isn't connected to the backend yet (config.js still has the placeholder URL).");
  }
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Server error (HTTP " + res.status + "). Please try again.");
  }
  return res.json();
}

const form = document.getElementById("regForm");
const errorBox = document.getElementById("errorBox");
const resultBox = document.getElementById("resultBox");
const codeDisplay = document.getElementById("codeDisplay");
const submitBtn = document.getElementById("submitBtn");
const submitLabel = document.getElementById("submitLabel");
const spinner = document.getElementById("spinner");
const copyBtn = document.getElementById("copyBtn");
const copiedHint = document.getElementById("copiedHint");

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.add("show");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.remove("show");
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitLabel.style.display = isLoading ? "none" : "inline";
  spinner.classList.toggle("show", isLoading);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const fullName = document.getElementById("fullName").value.trim();
  const countryCode = document.getElementById("countryCode").value;
  const mobileNumber = document.getElementById("mobileNumber").value.trim();

  if (!fullName || !mobileNumber) {
    showError("Both Full Name and Mobile Number are required.");
    return;
  }
  if (!/^[0-9]{6,14}$/.test(mobileNumber)) {
    showError("Please enter a valid mobile number (digits only).");
    return;
  }

  setLoading(true);
  try {
    const data = await callAppsScript({
      action: "register",
      fullName,
      countryCode,
      mobile: mobileNumber,
    });

    if (!data.success) {
      throw new Error(data.error || "Something went wrong. Please try again.");
    }

    codeDisplay.textContent = data.code;
    form.style.display = "none";
    resultBox.classList.add("show");
  } catch (err) {
    showError(err.message || "Network error. Please try again.");
  } finally {
    setLoading(false);
  }
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(codeDisplay.textContent);
    copiedHint.style.display = "block";
    setTimeout(() => (copiedHint.style.display = "none"), 1500);
  } catch {
    const range = document.createRange();
    range.selectNode(codeDisplay);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand("copy");
    window.getSelection().removeAllRanges();
    copiedHint.style.display = "block";
    setTimeout(() => (copiedHint.style.display = "none"), 1500);
  }
});
