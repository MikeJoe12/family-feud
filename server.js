const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

let gameState = {
    currentQuestion: null,
    revealed: [],
    multiplier: 1,
    scores: {
        leftScore: 0,
        rightScore: 0,
        roundScore: 0
    },
    teamNames: {
        team1: 'LEFT SIDE FAMILY',
        team2: 'RIGHT SIDE FAMILY'
    },
    activeTeam: null,
    strikes: 0,
    isStealMode: false,
    originalTeam: null
};

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/controller', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'controller.html'));
});

io.on('connection', (socket) => {
    socket.emit('initState', gameState);

    socket.on('teamNamesUpdate', (names) => {
        gameState.teamNames = names;
        io.emit('updateTeamNames', names);
    });

    socket.on('questionUpdate', (data) => {
        gameState.currentQuestion = data.question;
        gameState.revealed = [];
        gameState.isStealMode = false;
        gameState.originalTeam = null;
        io.emit('updateController', {
            question: data.question,
            revealed: [],
            teamNames: gameState.teamNames
        });
        io.emit('updateScores', gameState.scores);
    });

    socket.on('revealAnswer', (data) => {
        if (!gameState.revealed.includes(data.num)) {
            gameState.revealed.push(data.num);
            if (!gameState.isStealMode) {
                gameState.scores.roundScore += data.points * gameState.multiplier;
            }
            io.emit('revealAnswer', data.num);
            io.emit('updateScores', gameState.scores);
        }
    });

    socket.on('updateMultiplier', (multiplier) => {
        gameState.multiplier = multiplier;
        io.emit('updateMultiplier', multiplier);
    });

    socket.on('strike', () => {
        if (gameState.isStealMode) {
            // For wrong steal
            gameState.activeTeam = gameState.originalTeam;
            io.emit('setTeam', gameState.originalTeam);
            io.emit('strike');
            gameState.isStealMode = false;
            gameState.originalTeam = null;
        } else {
            gameState.strikes++;
            if (gameState.strikes === 3) {
                gameState.isStealMode = true;
                gameState.originalTeam = gameState.activeTeam;
                const newTeam = gameState.activeTeam === 'left' ? 'right' : 'left';
                gameState.activeTeam = newTeam;
                io.emit('setTeam', newTeam);
                io.emit('enterStealMode');
            }
            io.emit('strike');
        }
    });

    socket.on('nextQuestion', () => {
        gameState.revealed = [];
        gameState.strikes = 0;
        gameState.scores.roundScore = 0;
        gameState.isStealMode = false;
        gameState.originalTeam = null;
        io.emit('endStealMode');
        io.emit('nextQuestion');
        io.emit('updateScores', gameState.scores);
    });

    socket.on('resetGame', () => {
        gameState = {
            currentQuestion: null,
            revealed: [],
            multiplier: 1,
            scores: {
                leftScore: 0,
                rightScore: 0,
                roundScore: 0
            },
            teamNames: gameState.teamNames,
            activeTeam: null,
            strikes: 0,
            isStealMode: false,
            originalTeam: null
        };
        io.emit('gameReset', gameState);
        io.emit('refreshPage');
    });

    socket.on('setTeam', (team) => {
        if (!gameState.isStealMode) {
            gameState.activeTeam = team;
            io.emit('setTeam', team);
        }
    });

    socket.on('transferPoints', () => {
        if (gameState.activeTeam) {
            const scoreKey = `${gameState.activeTeam}Score`;
            gameState.scores[scoreKey] += gameState.scores.roundScore;
            gameState.scores.roundScore = 0;
            io.emit('updateScores', gameState.scores);
        }
    });
});

const PORT = process.env.PORT || 3003;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));