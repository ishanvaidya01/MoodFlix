import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

const BACKEND = "https://moodflix-backend-kztp.onrender.com";

function App() {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [trending, setTrending] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [loading, setLoading] = useState(false);

  const languages = [
    { label: "All", value: "" },
    { label: "English", value: "en" },
    { label: "Hindi", value: "hi" },
    { label: "Tamil", value: "ta" },
    { label: "Telugu", value: "te" },
    { label: "Kannada", value: "kn" }
  ];

  const searchMovies = async () => {
    setLoading(true);
    const res = await axios.post(`${BACKEND}/recommend`, {
      query,
      language
    });
    setSearchResults(res.data.results);
    setLoading(false);
  };

  const loadTrending = async () => {
    const res = await axios.get(`${BACKEND}/trending`);
    setTrending(res.data.results);
  };

  const loadTopRated = async () => {
    const res = await axios.get(`${BACKEND}/top-rated`);
    setTopRated(res.data.results);
  };

  useEffect(() => {
    loadTrending();
    loadTopRated();
  }, []);

  const renderRow = (title, movies) => (
    <>
      <h2 className="section-title">{title}</h2>
      <div className="row">
        {movies.map(movie => (
          <div key={movie.id} className="card">
            <img
              src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
              alt=""
            />
            <div className="rating">
              ⭐ {movie.vote_average.toFixed(1)} / 10
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="app">

      <div className="search-hero">
        <h1>MoodFlix AI</h1>
        <p>Describe your mood. I’ll find your movie.</p>

        <div className="search-box">
          <input
            placeholder="e.g. sad tamil love story"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchMovies()}
          />
          <button onClick={searchMovies}>Search</button>

          <select onChange={(e) => setLanguage(e.target.value)}>
            {languages.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="loader"></div>}

      {query && renderRow("Search Results", searchResults)}
      {renderRow("Most Trending Movies", trending)}
      {renderRow("High Rated Movies", topRated)}

    </div>
  );
}

export default App;