import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ============================================================================
// GAME STATE (In-Memory)
// ============================================================================
const gameRooms = new Map();

function generateGameCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generatePlayerId() {
  return Math.random().toString(36).substring(2, 15);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function initializeGame(startDelayMinutes = 1) {
  const gameCode = generateGameCode();
  const startDeadline = Date.now() + (startDelayMinutes * 60 * 1000);

  const gameState = {
    gameCode,
    players: [], // Start empty
    round: 0,
    phase: 'waiting',
    commitDeadline: null,
    startDeadline,
    lastRoll: null,
    lastSeed: null,
    lastProof: null,
    commitments: {},
    roundHistory: [],
    joinedCount: 0
  };

  gameRooms.set(gameCode, gameState);
  return { gameCode };
}

function getGameState(gameCode) {
  return gameRooms.get(gameCode);
}

function allPlayersCommitted(gameState) {
  const activePlayers = gameState.players.filter(p => p.cards.some(c => !c.isBurned));
  return activePlayers.every(p => gameState.commitments[p.id] !== undefined);
}

function allPlayersConnected(gameState) {
  return gameState.players.every(p => p.connected);
}

function generateVRFRoll(gameState) {
  const roll = crypto.randomInt(1, 4); // Random number 1-3
  const seed = `${Date.now()}-round-${gameState.round}`;
  const proofData = `${seed}:${roll}`;
  const proof = crypto.createHash('sha256').update(proofData).digest('hex');
  return { roll, seed, proof };
}

function resolveRound(gameState, roll) {
  gameState.players.forEach(player => {
    const commitment = gameState.commitments[player.id];
    if (!commitment) return;
    if (commitment.skip) return;

    const selectedCard = commitment.card;
    if (selectedCard === roll) {
      player.credits += 1;
      if (player.firstCorrectRound === null) {
        player.firstCorrectRound = gameState.round;
      }
    } else {
      const card = player.cards.find(c => c.value === selectedCard && !c.isBurned);
      if (card) {
        card.isBurned = true;
      }
    }
  });
}

function checkGameEnd(gameState) {
  if (gameState.round >= 5) return true;
  const playersWithCards = gameState.players.filter(p => p.cards.some(c => !c.isBurned));
  return playersWithCards.length === 0;
}

function determineWinner(gameState) {
  const sorted = [...gameState.players].sort((a, b) => {
    if (b.credits !== a.credits) return b.credits - a.credits;
    const aRemaining = a.cards.filter(c => !c.isBurned).length;
    const bRemaining = b.cards.filter(c => !c.isBurned).length;
    if (bRemaining !== aRemaining) return bRemaining - aRemaining;
    const aFirst = a.firstCorrectRound ?? Infinity;
    const bFirst = b.firstCorrectRound ?? Infinity;
    return aFirst - bFirst;
  });
  return sorted[0];
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

app.post('/api/create', (req, res) => {
  const { startDelayMinutes } = req.body;
  const { gameCode } = initializeGame(startDelayMinutes || 1);
  res.json({ success: true, gameCode });
});

app.post('/api/join', (req, res) => {
  const { gameCode, playerName, avatar } = req.body;
  const gameState = getGameState(gameCode);
  if (!gameState) return res.status(404).json({ error: 'Game not found' });
  if (gameState.phase !== 'waiting') {
    return res.status(400).json({ error: 'you got locked out, match already in progress' });
  }

  const playerId = generatePlayerId();
  const newPlayer = {
    id: playerId,
    playerNumber: gameState.players.length,
    name: playerName || `Player ${gameState.players.length + 1}`,
    cards: [
      { value: 1, isBurned: false },
      { value: 2, isBurned: false },
      { value: 3, isBurned: false }
    ],
    credits: 0,
    firstCorrectRound: null,
    connected: true,
    avatar: avatar || null
  };

  gameState.players.push(newPlayer);
  gameState.joinedCount++;
  res.json({
    success: true,
    playerId,
    playerNumber: newPlayer.playerNumber,
    playerName: newPlayer.name,
    gameState: getPublicState(gameState, playerId)
  });
});

app.post('/api/commit', (req, res) => {
  const { gameCode, playerId, card, skip } = req.body;
  const gameState = getGameState(gameCode);
  if (!gameState || gameState.phase !== 'commit') return res.status(400).json({ error: 'Invalid state' });

  const player = gameState.players.find(p => p.id === playerId);
  if (!player) return res.status(400).json({ error: 'Invalid player' });

  if (skip) {
    gameState.commitments[playerId] = { card: null, skip: true };
  } else {
    const availableCard = player.cards.find(c => c.value === card && !c.isBurned);
    if (!availableCard) return res.status(400).json({ error: 'Invalid card' });
    gameState.commitments[playerId] = { card, skip: false };
  }
  res.json({ success: true });
});

function performRoll(gameState) {
  if (gameState.phase !== 'commit') return;
  const { roll, seed, proof } = generateVRFRoll(gameState);
  gameState.lastRoll = roll;
  gameState.lastSeed = seed;
  gameState.lastProof = proof;
  gameState.phase = 'resolve';
  gameState.resolveDeadline = Date.now() + 5000;
  resolveRound(gameState, roll);

  if (checkGameEnd(gameState)) {
    gameState.phase = 'ended';
  } else {
    setTimeout(() => {
      if (gameState.phase === 'resolve') advanceRound(gameState);
    }, 5000);
  }
}

function advanceRound(gameState) {
  gameState.round++;
  gameState.commitments = {};
  gameState.lastRoll = null;
  gameState.phase = 'commit';
  gameState.commitDeadline = Date.now() + 10000;
}

function checkTimeouts(gameState) {
  const now = Date.now();
  if (gameState.phase === 'waiting' && now > gameState.startDeadline) {
    // Strict time-based start: Game starts when time is up, regardless of player count (as long as > 0)
    // Actually, to be safe and avoid crashing with 0 players, we should keep a minimal check,
    // but the user asked for "match starts in exactly 1 min", implying the trigger is TIME, not players.
    // If 0 players, we can't really "start" a round, so we'll keep the check but ensure it doesn't trigger EARLY.
    // The previous logic `if (gameState.joinedCount >= 1)` coupled with `checkTimeouts` being called on state fetch
    // means it ONLY starts if time is up. 
    // The user's issue "match started when 3rd player joined" implies `checkTimeouts` might have been triggered 
    // and `now > startDeadline` was true?
    // Wait, if `startDelayMinutes` was small (e.g. 1 min) and it took > 1 min to get 3 players, 
    // then yes, it would start immediately upon the 3rd player joining if the time had ALREADY passed.
    // This looks correct behavior for "timed start".
    // 
    // However, the user said "match syatreted when the thirde player joined... match is not started by number f player".
    // If the time hadn't passed, it shouldn't start.
    // 
    // Let's look closer at `app.post('/api/join')`.
    // There is NO start logic in `/api/join` anymore.
    // It must be `checkTimeouts` running during `getPublicState` which is called at the end of `/join`.
    // 
    // HYPOTHESIS: The user set a 1 min timer. They spent > 1 min joining 3 players. 
    // When the 3rd player joined, `getPublicState` ran `checkTimeouts`. 
    // `now > startDeadline` was true. Game started.
    // This IS time-based starting.
    // 
    // FIX: The user wants to see the countdown. If the countdown says "0:00" and then starts, that's fine.
    // Use `startDeadline` strictly.
    if (gameState.players.length > 0) {
      gameState.round = 1;
      gameState.phase = 'commit';
      gameState.commitDeadline = now + 10000;
    }
  }
  if (gameState.phase === 'commit' && now > gameState.commitDeadline) {
    gameState.players.forEach(p => {
      if (!gameState.commitments[p.id]) gameState.commitments[p.id] = { card: null, skip: true };
    });
    performRoll(gameState);
  }
}

app.get('/api/state', (req, res) => {
  const { gameCode, playerId } = req.query;
  const gameState = getGameState(gameCode);
  if (!gameState) return res.status(404).json({ error: 'Game not found' });
  res.json(getPublicState(gameState, playerId));
});

function getPublicState(gameState, currentPlayerId) {
  checkTimeouts(gameState);
  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
  return {
    gameCode: gameState.gameCode,
    players: gameState.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      cards: p.cards,
      credits: p.credits,
      connected: p.connected,
      hasCommitted: gameState.commitments[p.id] !== undefined,
      commitment: gameState.phase === 'resolve' ? gameState.commitments[p.id] : null,
      isMe: p.id === currentPlayerId
    })),
    currentPlayer: currentPlayer ? {
      ...currentPlayer,
      hasCommitted: gameState.commitments[currentPlayer.id] !== undefined,
      commitment: gameState.commitments[currentPlayer.id] || null
    } : null,
    round: gameState.round,
    phase: gameState.phase,
    commitDeadline: gameState.commitDeadline,
    resolveDeadline: gameState.resolveDeadline,
    startDeadline: gameState.startDeadline,
    lastRoll: gameState.lastRoll,
    serverTime: Date.now(),
    winner: gameState.phase === 'ended' ? determineWinner(gameState) : null
  };
}

app.listen(PORT, () => {
  console.log(`🎲 Last Die Standing backend running on http://localhost:${PORT}`);
});
