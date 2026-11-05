import { useEffect, useState } from "react";
import MovieCard from "./MovieCard.jsx";

function SkeletonCard() {
  return (
    <div className="w-[164px] shrink-0 md:w-[184px]">
      <div className="aspect-[2/3] animate-shimmer rounded-xl bg-[linear-gradient(110deg,#16161f_8%,#1e1e2a_18%,#16161f_33%)] bg-[length:200%_100%]" />
      <div className="mt-2 h-3 w-3/4 rounded bg-ink-700" />
      <div className="mt-1 h-2 w-1/2 rounded bg-ink-700" />
    </div>
  );
}

export default function ResultsStrip({ title, subtitle, movies, loading, favorites, favoriteTitles, onOpen, onToggleFavorite }) {
  if (loading) {
    return (
      <section className="mt-8">
        <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-widest text-neutral-400">{title}</h2>
        <div className="strip flex snap-x gap-3 overflow-x-auto pb-2">
          {[...Array(8)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </section>
    );
  }
  if (!movies?.length) return null;
  return (
    <section className="mt-8 animate-floatIn">
      <div className="mb-3 px-1">
        <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400">{title}</h2>
        {subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}
      </div>
      <div className="strip flex snap-x gap-3 overflow-x-auto pb-2 pt-1">
        {movies.map((m, i) => (
          <MovieCard
            key={m.id}
            movie={m}
            index={i}
            onOpen={onOpen}
            isFavorite={(favoriteTitles || []).has(String(m.title).toLowerCase())}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}
