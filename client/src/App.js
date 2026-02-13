import { useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [mood, setMood] = useState("");
  const [movies, setMovies] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [viewFavorites, setViewFavorites] = useState(false);

  const getMovies = async (newPage = 1, reset = false) => {
    if (!mood.trim()) return;

    setLoading(true);

    const res = await axios.post(
      "https://moodflix-backend-kztp.onrender.com/recommend",
      { mood, page: newPage }
    );

    if (reset) setMovies(res.data.movies);
    else setMovies(prev => [...prev, ...res.data.movies]);

    setTotalPages(res.data.total_pages);
    setPage(newPage);
    setLoading(false);
  };

  const loadMore = () => {
    if (page < totalPages) getMovies(page + 1);
  };

  const openMovie = async (id) => {
    const res = await axios.get(`https://moodflix-backend-kztp.onrender.com/movie/${id}`);
    setSelectedMovie(res.data);
  };

  const saveFavorite = async () => {
    await axios.post("https://moodflix-backend-kztp.onrender.com/favorite", {
      id: selectedMovie.id,
      title: selectedMovie.title,
      poster: selectedMovie.poster_path,
      rating: selectedMovie.vote_average,
      language: selectedMovie.original_language
    });

    alert("Saved!");
  };

  const removeFavorite = async (id) => {
    await axios.delete(`https://moodflix-backend-kztp.onrender.com/favorite/${id}`);
    loadFavorites();
  };

  const loadFavorites = async () => {
    const res = await axios.get("https://moodflix-backend-kztp.onrender.com/favorites");
    setFavorites(res.data);
    setViewFavorites(true);
  };

  const trailer =
    selectedMovie?.videos?.results?.find(
      v => v.type === "Trailer" && v.site === "YouTube"
    );

  return (
    <div className="app">
      <div className="content">
        <h1 className="title">MoodFlix</h1>

        <div className="controls">
          <input
            placeholder="Enter your mood..."
            value={mood}
            onChange={(e) => setMood(e.target.value)}
          />
          <button onClick={() => { setViewFavorites(false); getMovies(1, true); }}>
            Discover
          </button>
          <button className="fav-btn" onClick={loadFavorites}>
            Favorites
          </button>
        </div>

        {loading && <div className="loader"></div>}

        <div className="grid">
          {(viewFavorites ? favorites : movies).map(movie => (
            <div className="card" key={movie.id} onClick={() => openMovie(movie.id)}>
              <img
                src={`https://image.tmdb.org/t/p/w500${movie.poster || movie.poster_path}`}
                alt={movie.title}
              />
              <div className="card-overlay">
                <h3>{movie.title}</h3>
                <div className="meta">
                  ⭐ {movie.vote_average || movie.rating}
                  <span>{movie.original_language || movie.language}</span>
                </div>
                {viewFavorites && (
                  <button
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFavorite(movie.id);
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {!viewFavorites && page < totalPages && (
          <button className="load-more" onClick={loadMore}>
            Load More
          </button>
        )}

        {selectedMovie && (
          <div className="modal">
            <div className="modal-content">
              <span className="close" onClick={() => setSelectedMovie(null)}>×</span>
              <h2>{selectedMovie.title}</h2>
              <p>{selectedMovie.overview}</p>
              <p>⭐ IMDb: {selectedMovie.vote_average}</p>
              <p>Language: {selectedMovie.original_language}</p>

              {trailer && (
                <iframe
                  title="Trailer"
                  width="100%"
                  height="400"
                  src={`https://www.youtube.com/embed/${trailer.key}`}
                  allowFullScreen
                />
              )}

              <button className="save-btn" onClick={saveFavorite}>
                Save to Favorites
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
