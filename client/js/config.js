// Injected at build time by the GitHub Actions workflow.
// Falls back to localhost for local development.
const API_BASE_URL =
  window.__API_BASE_URL__ ||
  (window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "");

window.APP_CONFIG = { API_BASE_URL };
