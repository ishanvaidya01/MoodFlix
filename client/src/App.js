import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

const BACKEND = "https://moodflix-backend-kztp.onrender.com";

function App() {

  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [activeMovie, setActiveMovie] = useState(null);
  const [detailsCache, setDetailsCache] = useState({});
  const [showSplash, setShowSplash] = useState(true);
  const [loading, setLoading] = useState(false);   // ✅ FIXED POSITION

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  /* =========================
     SEARCH WITH LOADING
  ========================= */

  const searchMovies = async () => {
    if (!query.trim()) return;

    try {
      setLoading(true);

      const res = await axios.post(`${BACKEND}/search`, { query });

      setData(res.data);

    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }
  };

  /* =========================
     INPUT
  ========================= */

  const handleInput = (value) => {
    setQuery(value);

    if (!value.trim()) {
      setData(null);
      setActiveMovie(null);
    }
  };

  /* =========================
     MOVIE CLICK
  ========================= */

  const handleClick = async (movie) => {
    if (!detailsCache[movie.id]) {
      const res = await axios.get(`${BACKEND}/movie/${movie.id}`);
      setDetailsCache(prev => ({
        ...prev,
        [movie.id]: res.data
      }));
    }

    setActiveMovie(movie.id);
  };

  /* =========================
     ROW SCROLL
  ========================= */

  const scrollRow = (id, dir) => {
    const row = document.getElementById(id);
    if (!row) return;

    row.scrollBy({
      left: dir === "left" ? -900 : 900,
      behavior: "smooth"
    });
  };

  /* =========================
     RENDER ROW
  ========================= */

  const renderRow = (title, movies, id) =>
    movies?.length > 0 && (
      <div className="row-section">
        <h2>{title}</h2>
        <div className="row-wrapper">
          <button className="arrow left" onClick={() => scrollRow(id, "left")}>‹</button>

          <div className="row" id={id}>
            {movies.slice(0, 30).map(movie => (
              <div
                key={movie.id}
                className="card"
                onClick={() => handleClick(movie)}
              >
                <img
                  src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                  alt=""
                />
              </div>
            ))}
          </div>

          <button className="arrow right" onClick={() => scrollRow(id, "right")}>›</button>
        </div>
      </div>
    );

  /* =========================
     SPLASH SCREEN
  ========================= */

  if (showSplash) {
    return (
      <div className="splash">
        <h1 className="splash-logo">MoodFlix</h1>
      </div>
    );
  }

  /* =========================
     LANDING PAGE
  ========================= */

  if (!data) {
    return (
      <div className="landing">

        <h1 className="logo">MoodFlix</h1>
        <p className="tagline">Cinema shaped by emotion.</p>

        <div className="search-section">
          <input
            placeholder="How are you feeling today?"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
          />
          <button onClick={searchMovies}>Search</button>
        </div>

        <section className="about">

          <div className="about-card">
            <h1>About MoodFlix</h1>

            <h3>
              MoodFlix reimagines how we discover films.
              Instead of searching by title, genre, or actor,
              it begins with something more human — emotion.
            </h3>

            <h3>
              Whether you feel nostalgic, inspired, reflective,
              adventurous, or curious,
              MoodFlix maps your mood to curated cinematic
              experiences across multiple languages.
            </h3>
          </div>

          <div className="creator-card">
            <div className="creator-image">
              <img src="/myphoto.jpg" alt="Ishan Vaidya" />
            </div>

            <div className="creator-info">
              <h3>Ishan Vaidya</h3>
              <span>Full Stack Developer • AI Enthusiast</span>
              <p>
                Passionate about building intelligent,
                emotionally-aware digital systems that blend
                design, data, and user psychology.
              </p>
            </div>
          </div>

        </section>

        {loading && (
          <div className="loading-overlay">
            <div className="loader">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p>Finding the perfect movie for your mood...</p>
          </div>
        )}

      </div>
    );
  }

  /* =========================
     RESULTS PAGE
  ========================= */

  return (
    <div className="app">

      <div className="search-section">
        <input
          placeholder="Change your mood..."
          value={query}
          onChange={(e) => handleInput(e.target.value)}
        />
        <button onClick={searchMovies}>Search</button>
      </div>

      {renderRow("English", data.english, "en")}
      {renderRow("Hindi", data.hindi, "hi")}
      {renderRow("Tamil", data.tamil, "ta")}
      {renderRow("Telugu", data.telugu, "te")}
      {renderRow("Marathi", data.marathi, "mr")}

      {activeMovie && detailsCache[activeMovie] && (
        <>
          <div className="overlay" onClick={() => setActiveMovie(null)} />

          <div className="modal">
            {detailsCache[activeMovie].trailerKey && (
              <iframe
                src={`https://www.youtube.com/embed/${detailsCache[activeMovie].trailerKey}?autoplay=1`}
                allow="autoplay"
                title="Trailer"
              />
            )}

            <div className="modal-info">
              <h2>{detailsCache[activeMovie].title}</h2>
              <p>⭐ IMDb {detailsCache[activeMovie].vote_average}</p>
              <p>{detailsCache[activeMovie].overview}</p>
            </div>
          </div>
        </>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loader">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p>Finding the perfect movie for your mood...</p>
        </div>
      )}

    </div>
  );
}

export default App;