const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Database simulation
const db = {
    users: {},
    games: {}
};

// TMDB Configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

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
        status: 'waiting',
        turnState: null
    };
    return gameId;
}

function joinGame(gameId, player) {
    const game = db.games[gameId];
    if (!game || game.status !== 'waiting') {
        throw new Error('Game not found or already started');
    }
    if (!game.players.includes(player)) {
        game.players.push(player);
    }
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
        game.turnState = {
            forwardMovesLeft: 2,
            backwardMoveLeft: 1,
            currentPlayer: game.players[game.currentTurn]
        };
    }
}

function performAction(gameId, player, action, targetMovie) {
    const game = db.games[gameId];
    if (!game || game.status !== 'playing') {
        throw new Error('Invalid game state');
    }

    // Initialize turn state if it doesn't exist
    if (!game.turnState) {
        game.turnState = {
            forwardMovesLeft: 2,
            backwardMoveLeft: 1,
            currentPlayer: game.players[game.currentTurn]
        };
    }

    // Verify it's the player's turn
    if (game.turnState.currentPlayer !== player) {
        throw new E
