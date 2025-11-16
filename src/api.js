// src/api.js
import axios from "axios";

// Prefer env var, fallback to production API. Override with REACT_APP_API_BASE_URL for local/dev.
const baseURL =
  process.env.REACT_APP_API_BASE_URL?.trim() || "http://localhost:9000";

const api = axios.create({
  baseURL,
});

// Attach bearer token automatically if present
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      if (!config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {}
  return config;
});

export default api;
