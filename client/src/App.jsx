import { useCallback, useEffect, useMemo, useState } from "react";
import api, {
  getUserId,
  moods as fetchMoods,
  sendSearch,
  coldStart,
  addFavorite,
  removeFavorite,
  listFavorites,
  tasteProfile,
  modelInfo,
} from "./api.js";
import ResultsStrip from "./components/ResultsStrip.jsx";
import MovieModal from "./components/MovieModal.jsx";
import myPhoto from "./myphoto.jpg";

const MOOD_CHIP_HINTS = [
  { id: "feel-good", label: "Feel-good", query: "something cozy and feel good tonight" },
  { id: "heartbroken", label: "Heartbroken", query: "I'm heartbroken, show me something that understands" },
  { id: "excited", label: "Excited", query: "I'm hyped and full of adrenaline" },
  { id: "scared", label: "Scared", query: "make it creepy and haunted, I want to be scared" },
  { id: "curious", label: "Mind-bending", query: "mind bending plot, twists everywhere" },
  { id: "romantic", label: "Date night", query: "date night, something romantic" },
  { id: "nostalgic", label: "Nostalgic", query: "nostalgic warm memories vibes" },
  { id: "funny", label: "Funny", query: "I just want to laugh, something hilarious" },
  { id: "family-night", label: "Family night", query: "family night, kid friendly for everyone" },
  { id: "sci-fi", label: "Sci-fi", query: "space travel and alien futures" },
];

export default function App() {
  const [phase, setPhase] = useState("landing"); // landing | results
  const [serverReady, setServerReady] = useState(null); // null = checking
  const [model, setModel] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [activeMoods, setActiveMoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [profile, setProfile] = useState(null);
  const [selected, setSelected] = useState(null);

  const favTitles = useMemo(
    () => new Set(favorites.map((f) => String(f.title).toLowerCase())),
    [favorites]
  );

  /* ---------- boot ---------- */
  useEffect(() => {
    api
      .get("/api/health")
      .then((r) => setServerReady(r.data?.status === "ok"))
      .catch(() => setServerReady(false));
    modelInfo()
      .then((r) => setModel(r.data))
      .catch(() => {});
    listFavorites()
      .then((r) => setFavorites(r.data || []))
      .catch(() => {});
    tasteProfile()
      .then((r) => setProfile(r.data))
      .catch(() => {});
  }, []);

  /* ---------- search ---------- */
  const doSearch = useCallback(
    async (q) => {
      const text = String(q ?? "").trim();
      if (!text) {
        setError("Tell me how you're feeling first.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const r = await sendSearch(text, 30);
        setResults(r.data.results || []);
        setActiveMoods(r.data.moods || []);
        setPhase("results");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {
        setError(e.response?.data?.error || "The model couldn't rank that mood. Try different words.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const surpriseMe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await coldStart(30);
      setResults(r.data.results || []);
      setActiveMoods(["surprise me"]);
      setQuery("");
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Couldn't fetch recommendations.");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---------- favorites ---------- */
  const toggleFavorite = useCallback(
    async (movie, want) => {
      const existing = favorites.find(
        (f) => String(f.title).toLowerCase() === String(movie.title).toLowerCase()
      );
      if (want) {
        if (existing) return;
        const r = await addFavorite({
          title: movie.title,
          rating: movie.bayes ?? null,
        });
        setFavorites((prev) => [
          {
            id: r.data.id,
            title: movie.title,
            rating: movie.bayes ?? null,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        if (!existing) return;
        await removeFavorite(existing.id);
        setFavorites((prev) => prev.filter((f) => f.id !== existing.id));
      }
    },
    [favorites]
  );

  /* ---------- rating (live model update) ---------- */
  const onRated = useCallback((t) => {
    if (t && t.top) setProfile({ trained: true, top: t.top });
  }, []);

  /* ================================================================
     SPLASH / SETUP GUARD
  ================================================================ */
  if (serverReady === false) {
    return (
      <SetupScreen
        title="The model is offline"
        body="MoodFlix runs 100% locally — start the API server and refresh."
        code={`cd MoodFlix\nnpm run data:prepare   # downloads the MovieLens dataset (once)\nnpm start               # trains the model & serves :5000`}
      />
    );
  }
  if (serverReady === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulseSoft text-center">
          <span className="bg-gradient-to-r from-accent-rose to-accent-ember bg-clip-text text-4xl font-black text-transparent">
            MoodFlix
          </span>
          <p className="mt-2 text-xs uppercase tracking-[0.3em] text-neutral-500">
            warming up the model
          </p>
        </div>
      </div>
    );
  }

  /* ================================================================
     RESULTS VIEW
  ================================================================ */
  if (phase === "results") {
    return (
      <div className="relative z-10 mx-auto min-h-screen max-w-6xl px-4 pb-20 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <button onClick={() => setPhase("landing")} className="group flex items-center gap-3">
            <span className="text-2xl">🎬</span>
            <span className="text-lg font-black tracking-tight">
              Mood<span className="text-accent-rose">Flix</span>
            </span>
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              doSearch(query);
            }}
            className="flex w-full max-w-md gap-2 sm:w-auto"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="how are you feeling?"
              className="input-mood !px-4 !py-2.5 !text-sm"
              aria-label="Mood query"
            />
            <button className="btn-primary !px-4 !py-2.5 !text-sm" disabled={loading}>
              Search
            </button>
          </form>
        </header>

        {activeMoods.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-neutral-500">
              model read:
            </span>
            {activeMoods.map((m) => (
              <span key={m} className="chip !bg-accent-rose/10 !text-accent-rose">
                {m}
              </span>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-accent-rose/30 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose">
            {error}
          </p>
        )}

        <main>
          <ResultsStrip
            title={loading ? "Ranking films for your mood…" : "Picked for your mood"}
            subtitle={loading ? null : "scoring: taste × mood × quality, re-ranked for genre diversity"}
            movies={results}
            loading={loading}
            favoriteTitles={favTitles}
            onOpen={setSelected}
            onToggleFavorite={toggleFavorite}
          />

          {!loading && results.length === 0 && !error && (
            <p className="mt-10 text-center text-sm text-neutral-500">
              No films matched that feeling — try different words.
            </p>
          )}

          <ResultsStrip
            title="Your favorites"
            movies={favorites.map((f) => ({
              id: f.id,
              title: f.title,
              year: null,
              genres: [],
              bayes: f.rating,
              moodMatch: 0,
              why: [],
            }))}
            favoriteTitles={favTitles}
            onOpen={(m) => setResults.length && setSelected(results.find((r) => r.title === m.title) || m)}
            onToggleFavorite={toggleFavorite}
          />

          <ProfilePanel profile={profile} />
        </main>

        {selected && (
          <MovieModal
            movie={selected}
            onClose={() => setSelected(null)}
            onRated={onRated}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
          />
        )}
      </div>
    );
  }

  /* ================================================================
     LANDING
  ================================================================ */
  return (
    <div className="relative z-10 mx-auto min-h-screen max-w-6xl px-4 pb-20 sm:px-6">
      {/* nav */}
      <header className="flex items-center justify-between pt-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎬</span>
          <span className="text-lg font-black tracking-tight">
            Mood<span className="text-accent-rose">Flix</span>
          </span>
        </div>
        <span className="chip">
          {serverReady ? "● local model ready" : "● connecting…"}
        </span>
      </header>

      {/* hero */}
      <section className="mx-auto mt-16 max-w-2xl text-center sm:mt-24">
        <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-accent-rose">
          offline ml · zero api keys
        </p>
        <h1 className="mt-4 text-4xl font-black leading-tight sm:text-6xl">
          Cinema shaped by{" "}
          <span className="bg-gradient-to-r from-accent-rose via-accent-ember to-accent-gold bg-clip-text text-transparent">
            emotion
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-neutral-400">
          A matrix-factorization model trained on 100k real ratings turns your mood
          into a ranked film list — with <span className="text-neutral-200">visible reasons</span> for
          every pick. Everything runs on your machine.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            doSearch(query);
          }}
          className="mt-8"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="tell me how you're feeling…"
            className="input-mood text-center"
            aria-label="How are you feeling?"
          />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Ranking…" : "Match my mood"}
            </button>
            <button
              type="button"
              onClick={surpriseMe}
              className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/10"
            >
              🎲 Surprise me
            </button>
          </div>
        </form>

        {/* mood chips */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {MOOD_CHIP_HINTS.map((c) => (
            <button
              key={c.id}
              onClick={() => doSearch(c.query)}
              className="chip transition hover:border-accent-rose/40 hover:bg-accent-rose/10 hover:text-accent-rose"
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* model card */}
      {model?.evaluation && (
        <section className="mx-auto mt-20 max-w-3xl">
          <div className="grid gap-4 rounded-2xl border border-white/10 bg-ink-850/60 p-6 sm:grid-cols-4">
            <Stat label="Held-out RMSE" value={model.evaluation.rmse?.toFixed(3)} hint="lower is better" />
            <Stat label="MAE" value={model.evaluation.mae?.toFixed(2)} hint="avg star error" />
            <Stat label="Precision@10" value={`${Math.round((model.evaluation.precisionAt10 || 0) * 100)}%`} hint="top predictions rated ≥4★" />
            <Stat label="Ratings learned" value={model.evaluation.nTrain?.toLocaleString()} hint={`${model.evaluation.factors} latent factors`} />
          </div>
          <p className="mt-3 text-center text-xs text-neutral-500">{model.interpret}</p>
        </section>
      )}

      {/* creator / about */}
      <section className="mx-auto mt-16 max-w-3xl">
        <div className="flex flex-col items-center gap-6 rounded-2xl border border-white/10 bg-ink-850/60 p-6 sm:flex-row">
          <img
            src={myPhoto}
            alt="Ishan Vaidya"
            className="h-24 w-24 rounded-full border-2 border-accent-rose/50 object-cover shadow-lg shadow-accent-rose/20"
          />
          <div className="text-center sm:text-left">
            <p className="text-[11px] font-bold uppercase tracking-widest text-accent-rose">
              Built by
            </p>
            <h3 className="mt-1 text-xl font-bold">Ishan Vaidya</h3>
            <p className="mt-2 text-sm text-neutral-400">
              MoodFlix v2 replaced cloud APIs with a local FunkSVD matrix-factorization
              model trained on the MovieLens dataset. Your star ratings retrain the
              model live — taste vectors update with every review you leave.
            </p>
            <div className="mt-3 flex justify-center gap-2 sm:justify-start">
              <span className="chip">matrix factorization</span>
              <span className="chip">MovieLens</span>
              <span className="chip">explainable scoring</span>
              <span className="chip">100% local</span>
            </div>
          </div>
        </div>
      </section>

      {selected && (
        <MovieModal
          movie={selected}
          onClose={() => setSelected(null)}
          onRated={onRated}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      )}
    </div>
  );
}

/* ---------- small pieces ---------- */

function Stat({ label, value, hint }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-black tabular-nums text-neutral-100">{value ?? "—"}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-accent-rose">
        {label}
      </p>
      <p className="text-[10px] text-neutral-500">{hint}</p>
    </div>
  );
}

function ProfilePanel({ profile }) {
  if (!profile?.trained || !profile.top?.length) return null;
  return (
    <section className="mx-auto mt-16 max-w-2xl">
      <div className="rounded-2xl border border-white/10 bg-ink-850/60 p-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-accent-gold">
          Your learned taste profile
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Updated live as you rate films — this is the model's view of you.
        </p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {profile.top.map(({ genre, affinity }) => (
            <div key={genre} className="flex items-center gap-3">
              <span className="w-24 truncate text-xs font-semibold text-neutral-300">{genre}</span>
              <div
                className="score-bar h-2 flex-1 overflow-hidden rounded-full"
                style={{ "--percent": `${Math.round(affinity * 100)}%`, "--color": "#ffc247" }}
              />
              <span className="w-9 text-right text-[11px] tabular-nums text-neutral-400">
                {Math.round(affinity * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SetupScreen({ title, body, code }) {
  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div className="max-w-lg rounded-2xl border border-white/10 bg-ink-850 p-8 text-center">
        <span className="text-4xl">🔌</span>
        <h1 className="mt-4 text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-neutral-400">{body}</p>
        <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-black/40 p-4 text-left text-xs leading-relaxed text-neutral-300">
          {code}
        </pre>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary mt-5 !px-5 !py-2 !text-sm"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
