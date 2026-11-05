import { useEffect, useState } from "react";
import api, { movieDetails, rateMovie, getUserId, tasteProfile } from "../api.js";
import Poster from "./Poster.jsx";

export default function MovieModal({ movie, onClose, onRated, favorites, onToggleFavorite }) {
  const [details, setDetails] = useState(null);
  const [rating, setRating] = useState(0);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const isFav = (favorites || []).some((f) => f.title === movie.title);

  useEffect(() => {
    let alive = true;
    movieDetails(movie.id).then(
      (r) => alive && setDetails(r.data),
      () => {}
    );
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [movie.id, onClose]);

  async function submitRating(r) {
    if (busy) return;
    setBusy(true);
    setRating(r);
    try {
      await rateMovie(movie.id, r);
      const t = await tasteProfile();
      onRated?.(t.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {
      setRating(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label={movie.title}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto my-8 w-[94%] max-w-2xl animate-floatIn overflow-hidden rounded-2xl border border-white/10 bg-ink-850 shadow-2xl">
        <div className="flex gap-4 border-b border-white/10 bg-gradient-to-r from-accent-rose/10 to-transparent p-5">
          <div className="w-20 shrink-0">
            <Poster title={movie.title} year={movie.year} className="shadow-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate pr-8 text-xl font-bold">{movie.title}</h2>
            <p className="mt-0.5 text-xs text-neutral-400">
              {movie.year ? `${movie.year} · ` : ""}
              {(movie.genres || []).join(" · ")}
              {movie.bayes ? ` · ★ ${movie.bayes} community avg (${movie.nRatings} ratings)` : ""}
            </p>

            {/* your rating — feeds the model live */}
            <div className="mt-3 flex items-center gap-1.5">
              <span className="mr-1 text-[11px] font-medium text-neutral-400">Your rating:</span>
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  disabled={busy}
                  onClick={() => submitRating(r)}
                  className={`text-lg transition hover:scale-110 ${r <= rating ? "text-accent-gold" : "text-neutral-600"}`}
                  aria-label={`Rate ${r} star${r > 1 ? "s" : ""}`}
                >
                  ★
                </button>
              ))}
              {saved && <span className="text-[11px] text-emerald-400">saved — model updated ✓</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 h-8 w-8 rounded-full bg-black/40 text-white/70 transition hover:bg-black/70 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* why the model picked this */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-accent-rose">Why you're seeing this</p>
            <ul className="grid gap-1.5 sm:grid-cols-3">
              <li>
                <Metric label="Mood match" value={movie.moodMatch} color="#ff2d55" />
              </li>
              <li>
                <Metric label="Taste match" value={movie.tasteMatch} color="#ffc247" />
              </li>
              <li>
                <Metric label="Community quality" value={movie.quality} color="#48bb78" />
              </li>
            </ul>
          </div>

          {details && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {details.imdbUrl && (
                  <a
                    href={details.imdbUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-accent-gold px-4 py-1.5 text-xs font-bold text-black transition hover:brightness-110"
                  >
                    Watch info on IMDb ↗
                  </a>
                )}
                <span className="chip">scoring: local matrix-factorization model</span>
              </div>

              {details.neighbors?.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                    Learned neighbours — cosine similarity in the model's latent space
                  </p>
                  <div className="strip flex gap-3 overflow-x-auto pb-1">
                    {details.neighbors.map((n) => (
                      <div key={n.id} className="w-[110px] shrink-0">
                        <Poster title={n.title} year={n.year} className="shadow-md" />
                        <p className="mt-1 truncate text-[11px] text-neutral-300">{n.title}</p>
                        <p className="text-[10px] text-neutral-500">sim {n.sim}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color }) {
  const v = Math.round((value || 0) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-neutral-400">{label}</span>
        <span className="font-bold text-neutral-200">{v}%</span>
      </div>
      <div className="score-bar h-2 overflow-hidden rounded-full" style={{ "--percent": `${v}%`, "--color": color }} />
    </div>
  );
}
