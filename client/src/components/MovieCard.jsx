import { useEffect, useRef, useState } from "react";
import Poster from "./Poster.jsx";

function pct(n) {
  return Math.round((n || 0) * 100);
}

export default function MovieCard({ movie, index, onOpen, isFavorite, onToggleFavorite }) {
  const favBusy = useRef(false);
  const [heart, setHeart] = useState(isFavorite);

  useEffect(() => setHeart(isFavorite), [isFavorite]);

  async function toggleFav(e) {
    e.stopPropagation();
    if (favBusy.current) return;
    favBusy.current = true;
    const next = !heart;
    setHeart(next);
    try {
      await onToggleFavorite(movie, next);
    } catch {
      setHeart(!next);
    } finally {
      favBusy.current = false;
    }
  }

  const reasons = movie.why || [];

  return (
    <button
      onClick={() => onOpen(movie)}
      className="group w-[164px] shrink-0 snap-start text-left outline-none transition focus-visible:ring-2 focus-visible:ring-accent-rose/70 md:w-[184px]"
      aria-label={`${movie.title}${movie.year ? ` (${movie.year})` : ""} — open details`}
    >
      <div className="relative">
        <Poster
          title={movie.title}
          year={movie.year}
          className="transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-black/60"
        />
        {/* rank ribbon */}
        <span className="absolute left-2 top-2 z-20 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white/85 backdrop-blur">
          #{index + 1}
        </span>
        {/* favorite */}
        <span
          role="button"
          tabIndex={0}
          onClick={toggleFav}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleFav(e)}
          className={`absolute right-2 top-2 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full backdrop-blur transition ${
            heart ? "bg-accent-rose text-white shadow-lg shadow-accent-rose/40" : "bg-black/50 text-white/70 hover:bg-black/70"
          }`}
          aria-label={heart ? "Remove from favorites" : "Add to favorites"}
        >
          {heart ? "❤" : "♡"}
        </span>
        {/* rating */}
        {movie.bayes && (
          <span className="absolute bottom-2 right-2 z-20 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-bold text-accent-gold backdrop-blur">
            ★ {movie.bayes}
          </span>
        )}
      </div>

      <div className="px-1 pt-2">
        <p className="truncate text-sm font-semibold text-neutral-100">{movie.title}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-neutral-400">
          <span className="truncate">{(movie.genres || []).slice(0, 3).join(" · ")}</span>
        </div>
        {/* mood match bar — the ML is visible */}
        <div className="mt-1.5 flex items-center gap-1.5">
          <div
            className="score-bar h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ "--percent": `${pct(movie.moodMatch)}%`, "--color": "#ff2d55" }}
            title={`Mood match ${pct(movie.moodMatch)}%`}
          />
          <span className="w-9 text-right text-[10px] font-semibold text-neutral-400">{pct(movie.moodMatch)}%</span>
        </div>
        <p className="mt-1 truncate text-[10px] text-neutral-500" title={reasons.join(" · ")}>
          {reasons.join(" · ")}
        </p>
      </div>
    </button>
  );
}
