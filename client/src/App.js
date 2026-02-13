import { useState, useRef } from "react";
import axios from "axios";
import "./App.css";

const BACKEND = "https://moodflix-backend-kztp.onrender.com";

function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [detailsCache, setDetailsCache] = useState({});
  const [direction, setDirection] = useState("center");

  const hoverTimer = useRef(null);

  const searchMovies = async () => {
    if (!query.trim()) return;
    const res = await axios.post(`${BACKEND}/recommend`, { query });
    setResults(res.data.results);
  };

  const handleHover = async (movie, event) => {
    clearTimeout(hoverTimer.current);

    const rect = event.currentTarget.getBoundingClientRect();
    const screenWidth = window.innerWidth;

    if (rect.left < screenWidth * 0.3) {
      setDirection("right");
    } else if (rect.right > screenWidth * 0.7) {
      setDirection("left");
    } else {
      setDirection("center");
    }

    hoverTimer.current = setTimeout(async () => {
      setExpandedId(movie.id);

      if (!detailsCache[movie.id]) {
        const res = await axios.get(`${BACKEND}/movie/${movie.id}`);
        setDetailsCache(prev => ({
          ...prev,
          [movie.id]: res.data
        }));
      }
    }, 350);
  };

  const handleLeave = () => {
    clearTimeout(hoverTimer.current);
    setExpandedId(null);
  };

  return (
    <div className={`app ${expandedId ? "focus-mode" : ""}`}>

      <div className="search-section">
        <h1>MoodFlix AI</h1>

        <div className="search-box">
          <input
            placeholder="Describe your mood..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchMovies()}
          />
          <button onClick={searchMovies}>Search</button>
        </div>
      </div>

      <div className="grid">
        {results.map(movie => {
          const details = detailsCache[movie.id];

          return (
            <div
              key={movie.id}
              className="card"
              onMouseEnter={(e) => handleHover(movie, e)}
              onMouseLeave={handleLeave}
            >
              <img
                src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                alt=""
              />

              {expandedId === movie.id && details && (
                <div className={`expanded-card ${direction}`}>
                  {details.trailerKey && (
                    <iframe
                      src={`https://www.youtube.com/embed/${details.trailerKey}?autoplay=1&mute=1&controls=0`}
                      allow="autoplay"
                      title="Trailer"
                    />
                  )}

                  <div className="expanded-info">
                    <h2>{details.title}</h2>

                    <div className="meta">
                      <span className="rating-badge">
                        ⭐ {details.vote_average.toFixed(1)}
                      </span>
                      <span>{details.runtime} min</span>
                      <span>{details.release_date?.split("-")[0]}</span>
                    </div>

                    <p className="overview">
                      {details.overview.slice(0, 180)}...
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}

export default App;