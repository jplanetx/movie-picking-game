const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Database simulation
const db = {
  users: {},
  games: {}
};

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Game Logic Functions
function authenticateUser(username, password) {
  if (!db.users[username]) {
    db.users[username] = { password, games: [] };
  }
  return { username };
}

function createGame(owner) {
  const gameId = Math.random().toString(36).substr(2, 9);
  db.games[gameId] = {
    owner,
    players: [owner],
    movies: {},
    currentTurn: 0,
    rounds: 0,
    maxRounds: 10,
    winningScore: 20,
    status: 'waiting'
  };
  return gameId;
}

function joinGame(gameId, player) {
  const game = db.games[gameId];
  if (!game || game.status !== 'waiting') {
    throw new Error('Game not found or already started');
  }
  game.players.push(player);
}

function selectMovie(gameId, player, movieTitle, movieId, poster) {
    const game = db.games[gameId];
    if (!game) throw new Error('Game not found');
    game.movies[player] = { 
        title: movieTitle,
        score: 5,
        movieId: movieId,
        poster: poster 
    };
    if (Object.keys(game.movies).length === game.players.length) {
        game.status = 'playing';
    }
}

function performAction(gameId, player, action, targetMovie) {
  const game = db.games[gameId];
  if (!game || game.status !== 'playing') {
    throw new Error('Invalid game state');
  }

  const movieEntry = Object.entries(game.movies).find(([_, movie]) => movie.title === targetMovie);
  if (!movieEntry) throw new Error('Movie not found');

  const [_, movie] = movieEntry;

  if (action === 'forward') {
    movie.score += 2;
  } else if (action === 'backward') {
    movie.score = Math.max(0, movie.score - 1);
  }

  game.currentTurn = (game.currentTurn + 1) % game.players.length;
  game.rounds++;

  if (movie.score >= game.winningScore || game.rounds >= game.maxRounds * game.players.length) {
    game.status = 'finished';
    game.winner = getWinner(game);
  }
}

function getWinner(game) {
  return Object.entries(game.movies)
    .reduce((a, b) => a[1].score > b[1].score ? a : b)[1].title;
}

function getGameState(gameId) {
  const game = db.games[gameId];
  if (!game) throw new Error('Game not found');
  
  return {
    players: game.players,
    movies: game.movies,
    currentTurn: game.players[game.currentTurn],
    rounds: Math.floor(game.rounds / game.players.length),
    status: game.status,
    winner: game.winner
  };
}

// Health check endpoint for Vercel
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

// API Routes
app.post('/api/auth', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = authenticateUser(username, password);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/games', (req, res) => {
  try {
    const { username } = req.body;
    const gameId = createGame(username);
    res.json({ gameId });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/games/:gameId/join', (req, res) => {
  try {
    const { gameId } = req.params;
    const { username } = req.body;
    joinGame(gameId, username);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/games/:gameId/select-movie', (req, res) => {
    try {
        const { gameId } = req.params;
        const { username, movieTitle, movieId, poster } = req.body;
        selectMovie(gameId, username, movieTitle, movieId, poster);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/games/:gameId/action', (req, res) => {
  try {
    const { gameId } = req.params;
    const { username, action, targetMovie } = req.body;
    performAction(gameId, username, action, targetMovie);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/games/:gameId', (req, res) => {
  try {
    const { gameId } = req.params;
    const gameState = getGameState(gameId);
    res.json(gameState);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Search movies
app.get('/api/movies/search', async (req, res) => {
    try {
        const { query } = req.query;
        const response = await fetch(
            `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=1`
        );
        const data = await response.json();
        res.json(data.results.map(movie => ({
            id: movie.id,
            title: movie.title,
            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : null,
            year: movie.release_date ? movie.release_date.split('-')[0] : '',
            overview: movie.overview
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get movie details
app.get('/api/movies/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}&language=en-US`
        );
        const movie = await response.json();
        res.json({
            id: movie.id,
            title: movie.title,
            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w400${movie.poster_path}` : null,
            year: movie.release_date ? movie.release_date.split('-')[0] : '',
            overview: movie.overview,
            rating: movie.vote_average
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
  console.log(`Movie Picking Game server running at http://localhost:${port}`);
});
