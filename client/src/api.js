import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: BASE,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

/** Stable per-browser user id so the taste model can learn across sessions. */
export function getUserId() {
  let id = localStorage.getItem("moodflix-user");
  if (!id) {
    id = "u_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("moodflix-user", id);
  }
  return id;
}

export const health = () => api.get("/api/health");
export const moods = () => api.get("/api/moods");
export const modelInfo = () => api.get("/api/model");
export const sendSearch = (query, limit) =>
  api.post("/api/search", { query, limit, userId: getUserId() });
export const coldStart = (limit) => api.get("/api/recommend", { params: { limit, userId: getUserId() } });
export const movieDetails = (id) => api.get(`/api/movie/${id}`, { params: { userId: getUserId() } });
export const rateMovie = (movieId, rating) =>
  api.post("/api/rate", { movieId, rating, userId: getUserId() });
export const tasteProfile = () => api.get("/api/profile", { params: { userId: getUserId() } });
export const listFavorites = () => api.get("/api/favorites");
export const addFavorite = (payload) => api.post("/api/favorites", { ...payload, language: "en" });
export const removeFavorite = (id) => api.delete(`/api/favorites/${id}`);

export default api;
