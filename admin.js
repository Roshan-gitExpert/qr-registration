const TOKEN_KEY = "qr_admin_token";

const loginCard = document.getElementById("loginCard");
const dashboardCard = document.getElementById("dashboardCard");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const downloadXlsxBtn = document.getElementById("downloadXlsxBtn");
const countStat = document.getElementById("countStat");
const tableBody = document.getElementById("tableBody");
const dashError = document.getElementById("dashError");

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}
function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}
function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

function showLogin() {
  loginCard.style.display = "block";
  dashboardCard.style.display = "none";
}
function showDashboard() {
  loginCard.style.display = "none";
  dashboardCard.style.display = "block";
  loadRegistrations();
}

function checkConfigured() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf("PASTE_YOUR_WEB_APP_URL_HERE") !== -1) {
    loginError.textContent = "The site isn't connected to the backend yet (config.js still has the placeholder URL).";
    loginError.classList.add("show");
    return false;
  }
  return true;
}

// GET requests with only URL params (no custom headers) are "simple
// requests" so no CORS preflight is triggered — Apps Script web apps
// respond to these directly.
async function getFromAppsScript(params) {
  const url = new URL(APPS_SCRIPT_URL);
  Object.keys(params).forEach((k) => url.searchParams.set(k, params[k]));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Server error (HTTP " + res.status + ").");
  return res.json();
}

async function postToAppsScript(payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Server error (HTTP " + res.status + ").");
  return res.json();
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.remove("show");
  if (!checkConfigured()) return;

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in...";

  try {
    const data = await postToAppsScript({ action: "adminLogin", username, password });
    if (!data.success) throw new Error(data.error || "Login failed.");
    setToken(data.token);
    showDashboard();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.add("show");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Log In";
  }
});

logoutBtn.addEventListener("click", () => {
  clearToken();
  showLogin();
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function loadRegistrations() {
  dashError.classList.remove("show");
  const token = getToken();
  if (!token) {
    showLogin();
    return;
  }

  try {
    const data = await getFromAppsScript({
      action: "adminList",
      token,
      q: searchInput.value.trim(),
    });

    if (!data.success) {
      if (/not authenticated/i.test(data.error || "")) {
        clearToken();
        showLogin();
        return;
      }
      throw new Error(data.error || "Failed to load registrations.");
    }

    countStat.textContent = `${data.count} registration${data.count === 1 ? "" : "s"}`;
    tableBody.innerHTML = "";

    data.results
      .slice()
      .reverse() // newest first
      .forEach((row) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(row.serialNumber)}</td>
          <td>${escapeHtml(row.fullName)}</td>
          <td>${escapeHtml(row.countryCode)} ${escapeHtml(row.mobileNumber)}</td>
          <td><code class="gen-code">${escapeHtml(row.code)}</code></td>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.time)}</td>
        `;
        tableBody.appendChild(tr);
      });
  } catch (err) {
    dashError.textContent = err.message;
    dashError.classList.add("show");
  }
}

searchBtn.addEventListener("click", loadRegistrations);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadRegistrations();
});

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

downloadCsvBtn.addEventListener("click", async () => {
  dashError.classList.remove("show");
  const token = getToken();
  try {
    const data = await getFromAppsScript({ action: "adminExportCsv", token });
    if (!data.success) throw new Error(data.error || "Export failed.");
    const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, "registrations.csv");
  } catch (err) {
    dashError.textContent = err.message;
    dashError.classList.add("show");
  }
});

downloadXlsxBtn.addEventListener("click", async () => {
  dashError.classList.remove("show");
  const token = getToken();
  try {
    const data = await getFromAppsScript({ action: "adminExportXlsx", token });
    if (!data.success) throw new Error(data.error || "Export failed.");
    const binary = atob(data.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    triggerDownload(blob, "registrations.xlsx");
  } catch (err) {
    dashError.textContent = err.message;
    dashError.classList.add("show");
  }
});

// On load: if we already have a token in this browser tab, try the
// dashboard straight away (loadRegistrations will bounce back to login
// if the token turned out to be expired/invalid).
if (getToken()) {
  showDashboard();
} else {
  showLogin();
}
