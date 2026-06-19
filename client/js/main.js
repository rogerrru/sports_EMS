// Shared functionality loaded on every page

let currentUser = null;
let _readyResolve;
const _readyPromise = new Promise((res) => { _readyResolve = res; });

async function initPage() {
  try {
    currentUser = await window.API.auth.me();
  } catch (_) {
    currentUser = null;
  }
  renderNavbar();
  _readyResolve();
}

function getActivePage() {
  const path = window.location.pathname.toLowerCase();
  const file = path.split("/").pop() || "index.html";
  if (file === "" || file === "index.html") return "index";
  if (file === "event.html") return "events";
  if (file.startsWith("events")) return "events";
  if (file.startsWith("myevents")) return "myevents";
  if (file.startsWith("account")) return "account";
  if (file.startsWith("login")) return "login";
  if (file.startsWith("signup")) return "signup";
  return file.replace(".html", "");
}

function renderNavbar() {
  const nav = document.getElementById("navbar-placeholder");
  if (!nav) return;

  const isLoggedIn = !!currentUser;
  const active = getActivePage();

  const navLink = (href, page, label) => {
    const isActive = active === page;
    return `<li class="nav-item">
      <a href="${href}" class="nav-link${isActive ? " nav-link--active" : ""}">${label}</a>
    </li>`;
  };

  const myEventsLink = isLoggedIn ? navLink("myEvents.html", "myevents", "My Events") : "";

  const userMenu = isLoggedIn
    ? `<li class="nav-item">
        <div class="nav-link-submenu">
          <span class="submenu-trigger">Welcome, ${escHtml(currentUser.firstName)} ▾</span>
          <ul class="subMenu">
            <li><a href="account.html">Account</a></li>
            <li><a href="#" id="logout-btn">Log Out</a></li>
          </ul>
        </div>
      </li>`
    : `<li class="nav-item">
        <a href="login.html" class="nav-link nav-link--cta${active === "login" ? " nav-link--active" : ""}">Log In</a>
      </li>`;

  nav.innerHTML = `
    <nav class="navbar">
      <a href="index.html" class="nav-logo">
        <img src="assets/media/logo.png" alt="SLU Logo" />
      </a>
      <ul class="nav-menu">
        ${navLink("index.html", "index", "Overview")}
        ${navLink("events.html", "events", "Events")}
        ${myEventsLink}
        ${userMenu}
      </ul>
      <button class="hamburger" aria-label="Toggle menu" aria-expanded="false">
        <span class="bar"></span><span class="bar"></span><span class="bar"></span>
      </button>
    </nav>`;

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await window.API.auth.logout();
      } catch (_) {}
      window.location.href = "index.html";
    });
  }

  const hamburger = nav.querySelector(".hamburger");
  const navMenu = nav.querySelector(".nav-menu");
  hamburger?.addEventListener("click", () => {
    const expanded = hamburger.getAttribute("aria-expanded") === "true";
    hamburger.setAttribute("aria-expanded", String(!expanded));
    hamburger.classList.toggle("active");
    navMenu.classList.toggle("active");
  });

  // Close mobile menu on outside click
  document.addEventListener("click", (e) => {
    if (!nav.contains(e.target)) {
      hamburger?.classList.remove("active");
      hamburger?.setAttribute("aria-expanded", "false");
      navMenu?.classList.remove("active");
    }
  }, { once: false });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(dateStr) {
  if (!dateStr) return "TBD";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function showError(containerId, message) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<p class="error-msg">${escHtml(message)}</p>`;
}

function requireLogin() {
  if (!currentUser) {
    window.location.href = "login.html";
    return false;
  }
  return true;
}

// Returns null if the user is eligible, or an error string if not.
// Pass user=null for guests (handled separately as "log in to register").
function checkEligibility(event, user) {
  if (!user) return null;
  const cat = (event.eventCategory || "").toLowerCase();
  if (cat === "university") {
    return user.email?.endsWith("@slu.edu.ph")
      ? null
      : "This event is open to SLU university email holders only (@slu.edu.ph).";
  }
  if (cat === "departmental") {
    return (user.depID && String(user.depID) === String(event.depID))
      ? null
      : "This event is restricted to members of the host department.";
  }
  if (cat === "organizational") {
    return (user.orgID && String(user.orgID) === String(event.orgID))
      ? null
      : "This event is restricted to members of the host organization.";
  }
  return null; // open or unknown category
}

window.Page = { ready: () => _readyPromise, initPage, currentUser: () => currentUser, escHtml, formatDate, showError, requireLogin, checkEligibility };
document.addEventListener("DOMContentLoaded", initPage);
