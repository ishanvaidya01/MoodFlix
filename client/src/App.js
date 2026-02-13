import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

const BACKEND = "https://moodflix-backend-kztp.onrender.com";

function App() {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [type, setType] = useState("movie");
  const [results, setResults] = useState([]);
  const [featured, setFeatured] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const languages = [
    { label: "All", value: "" },
    { label: "English", value: "en" },
    { label: "Hindi", value: "hi" },
    { label: "Tamil", value: "ta" },
    { label: "Telugu", value: "te" },
    { label: "Kannada", value: "kn" }
  ];

  const search = async () => {
    setLoading(true);

    const res = await axios.post(`${BACKEND}/recommend`, {
      query,
      language,
      type
    });

    setResults(res.data.results);
    setFeatured(res.data.results[0]);
    setLoading(false);
  };

  const openDetails = async (id) => {
    const res = await axios.get(`${BACKEND}/details/${type}/${id}`);
    setSelected(res.data);
  };

  useEffect(() => {
    search();
  }, [language, type]);

  return (
    <div className="app">

      <div className="navbar">
        <div className="logo">MoodFlix AI</div>

        <div className="search-container">
          <input
            placeholder="Describe what you feel..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <button onClick={search}>Search</button>
        </div>

        <select onChange={(e) => setLanguage(e.target.value)}>
          {languages.map(l => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <div className="toggle">
          <button
            className={type === "movie" ? "active" : ""}
            onClick={() => setType("movie")}
          >
            Movies
          </button>
          <button
            className={type === "tv" ? "active" : ""}
            onClick={() => setType("tv")}
          >
            Web Series
          </button>
        </div>
      </div>

      {featured && (
        <div
          className="hero"
          style={{
            backgroundImage: `url(https://image.tmdb.org/t/p/original${featured.backdrop_path})`
          }}
        >
          <div className="hero-content">
            <h1>{featured.title || featured.name}</h1>
            <p>⭐ {featured.vote_average.toFixed(1)} / 10</p>
            <button onClick={() => openDetails(featured.id)}>
              Explore
            </button>
          </div>
        </div>
      )}

      {loading && <div className="loader"></div>}

      <div className="grid">
        {results.map(item => (
          <div
            key={item.id}
            className="card"
            onClick={() => openDetails(item.id)}
          >
            <img
              src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
              alt=""
            />
            <div className="rating">
              {item.vote_average.toFixed(1)} / 10
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="modal">
          <div className="modal-content">
            <span onClick={() => setSelected(null)}>×</span>
            <h2>{selected.title || selected.name}</h2>
            <p>{selected.overview}</p>

            <div className="providers">
              {selected.watchProviders?.map(p => (
                <a
                  key={p.provider_id}
                  href={`https://www.google.com/search?q=watch+${selected.title}+on+${p.provider_name}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={`https://image.tmdb.org/t/p/w200${p.logo_path}`}
                    alt=""
                  />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;