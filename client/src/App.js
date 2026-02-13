import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

const BACKEND = "https://moodflix-backend-kztp.onrender.com";

function App() {
  const [query, setQuery] = useState("");
  const [trending, setTrending] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [results, setResults] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [detailsCache, setDetailsCache] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInitial();
  }, []);

  const loadInitial = async () => {
    const trendingRes = await axios.get(`${BACKEND}/trending`);
    const topRatedRes = await axios.get(`${BACKEND}/top-rated`);
    setTrending(trendingRes.data);
    setTopRated(topRatedRes.data);
  };

  const searchMovies = async () => {
    if (!query.trim()) return;

    setLoading(true);
    const res = await axios.post(`${BACKEND}/search`, { query });
    setResults(res.data);
    setLoading(false);
  };

  const handleHover = async (movie) => {
    setExpanded(movie.id);

    if (detailsCache[movie.id]) return;

    const res = await axios.get(`${BACKEND}/movie/${movie.id}`);

    setDetailsCache(prev => ({
      ...prev,
      [movie.id]: res.data
    }));
  };

  const renderGrid = (movies) => (
    <div className="grid">
      {movies.map(movie => {
        const details = detailsCache[movie.id];

        return (
          <div
            key={movie.id}
            className="card"
            onMouseEnter={() => handleHover(movie)}
            onMouseLeave={() => setExpanded(null)}
          >
            <img
              src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
              alt=""
            />

            {expanded === movie.id && details && (
              <div className="hover-card">
                {details.trailerKey && (
                  <iframe
                    src={`https://www.youtube.com/embed/${details.trailerKey}?autoplay=1&mute=1`}
                    allow="autoplay"
                    title="Trailer"
                  />
                )}
                <div className="info">
                  <h3>{details.title}</h3>
                  <p>
                    ⭐ {details.vote_average.toFixed(1)} |{" "}
                    {details.original_language.toUpperCase()} |{" "}
                    {details.release_date?.split("-")[0]}
                  </p>
                  <p>{details.overview.slice(0, 150)}...</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="app">

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

      {loading && <h2 style={{textAlign:"center"}}>Loading...</h2>}

      {!loading && results.length === 0 ? (
        <>
          <h2>Trending Movies</h2>
          {renderGrid(trending)}

          <h2>Top Rated Movies</h2>
          {renderGrid(topRated)}
        </>
      ) : (
        <>
          <h2>Search Results</h2>
          {renderGrid(results)}
        </>
      )}

    </div>
  );
}

export default App;