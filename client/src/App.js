import { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./App.css";

const BACKEND = "https://moodflix-backend-kztp.onrender.com";

function App() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState({
    hero: [],
    english: [],
    hindi: [],
    tamil: [],
    telugu: [],
    marathi: []
  });
  const [expanded, setExpanded] = useState(null);
  const [detailsCache, setDetailsCache] = useState({});
  const [showSplash, setShowSplash] = useState(true);
  const debounceRef = useRef(null);

  useEffect(() => {
    setTimeout(() => setShowSplash(false), 3000);
  }, []);

  const searchMovies = async () => {
    if (!query.trim()) return;

    const res = await axios.post(`${BACKEND}/search`, { query });
    setData(res.data);
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

  const scroll = (id, dir, e) => {
    e.stopPropagation(); // FIX arrow triggering hover
    document.getElementById(id).scrollBy({
      left: dir === "left" ? -800 : 800,
      behavior: "smooth"
    });
  };

  if (showSplash) {
    return (
      <div className="splash">
        <h1 className="logo">MoodFlix</h1>
      </div>
    );
  }

  const renderRow = (title, movies, id) =>
    movies.length > 0 && (
      <div className="row-section">
        <h2>{title}</h2>
        <div className="row-wrapper">
          <button className="arrow left" onClick={(e)=>scroll(id,"left",e)}>‹</button>
          <div className="row" id={id}>
            {movies.slice(0, 60).map(movie => {
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
                      <h3>{details.title}</h3>
                      <p>⭐ IMDb {details.vote_average}</p>
                      <p>{details.overview.slice(0,120)}...</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button className="arrow right" onClick={(e)=>scroll(id,"right",e)}>›</button>
        </div>
      </div>
    );

  return (
    <div className="app">

      <div className="hero-text">
        <h1>Tell us your mood.</h1>
        <p>We’ll find the perfect movie for how you feel.</p>
      </div>

      <div className="search-section">
        <input
          placeholder="Feeling sad? excited? nostalgic?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={searchMovies}>Search</button>
      </div>

      {renderRow("English", data.english, "en")}
      {renderRow("Hindi", data.hindi, "hi")}
      {renderRow("Tamil", data.tamil, "ta")}
      {renderRow("Telugu", data.telugu, "te")}
      {renderRow("Marathi", data.marathi, "mr")}

    </div>
  );
}

export default App;