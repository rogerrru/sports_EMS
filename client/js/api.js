const base = () => window.APP_CONFIG.API_BASE_URL;

async function apiFetch(path, options = {}) {
  const url = `${base()}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || res.statusText), { status: res.status });
  }
  return res.json();
}

// Auth
const auth = {
  login: (email, password) =>
    apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => apiFetch("/api/auth/logout", { method: "POST" }),
  me: () => apiFetch("/api/auth/me"),
  signup: (data) => apiFetch("/api/auth/signup", { method: "POST", body: JSON.stringify(data) }),
};

// Public data (no auth required)
const publicApi = {
  events: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/public/events${qs ? "?" + qs : ""}`);
  },
  event: (id) => apiFetch(`/api/public/events/${id}`),
  latestEvents: () => apiFetch("/api/public/latestEvents"),
  departments: () => apiFetch("/api/public/departments"),
  organizations: () => apiFetch("/api/public/organizations"),
};

// Authenticated user actions
const userApi = {
  myEvents: () => apiFetch("/api/user/events"),
  registerEvent: (eventId) =>
    apiFetch(`/api/user/registerEvent/${eventId}`, { method: "POST" }),
  account: () => apiFetch("/api/user/account"),
  updateAccount: (data) =>
    apiFetch("/api/user/account", { method: "PUT", body: JSON.stringify(data) }),
  forfeitEvent: (eventRegID) =>
    apiFetch(`/api/user/events/${eventRegID}`, { method: "DELETE" }),
};

window.API = { auth, public: publicApi, user: userApi };
