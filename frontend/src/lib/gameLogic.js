import crypto from 'crypto';

export function generateGameCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function generatePlayerId() {
    return Math.random().toString(36).substring(2, 15);
}

export function initializeGame(startDelayMinutes = 1) {
    const gameCode = generateGameCode();
    const startDeadline = Date.now() + (startDelayMinutes * 60 * 1000);

    const gameState = {
        gameCode,
        players: [],
        round: 0,
        phase: 'waiting',
        commitDeadline: null,
        startDeadline,
        lastRoll: null,
        lastSeed: null,
        lastProof: null,
        commitments: {},
        joinedCount: 0
    };

    return gameState;
}

export function determineWinner(gameState) {
    if (!gameState?.players?.length) return null;

    const sorted = [...gameState.players].filter(p => p).sort((a, b) => {
        const aCredits = a.credits || 0;
        const bCredits = b.credits || 0;
        if (bCredits !== aCredits) return bCredits - aCredits;

        const aCards = a.cards || [];
        const bCards = b.cards || [];
        const aRemaining = aCards.filter(c => !c.isBurned).length;
        const bRemaining = bCards.filter(c => !c.isBurned).length;
        if (bRemaining !== aRemaining) return bRemaining - aRemaining;

        const aFirst = a.firstCorrectRound ?? Infinity;
        const bFirst = b.firstCorrectRound ?? Infinity;
        return aFirst - bFirst;
    });
    return sorted[0];
}

export function checkGameEnd(gameState) {
    if (gameState.round >= 5) return true;
    const playersWithCards = gameState.players.filter(p => p.cards.some(c => !c.isBurned));
    return playersWithCards.length === 0;
}

export function generateVRFRoll(gameState) {
    const roll = crypto.randomInt(1, 4); // Random number 1-3
    const seed = `${Date.now()}-round-${gameState.round}`;
    const proofData = `${seed}:${roll}`;
    const proof = crypto.createHash('sha256').update(proofData).digest('hex');
    return { roll, seed, proof };
}

export function resolveRound(gameState, roll) {
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

export function performRoll(gameState) {
    if (gameState.phase !== 'commit') return;
    const { roll, seed, proof } = generateVRFRoll(gameState);
    gameState.lastRoll = roll;
    gameState.lastSeed = seed;
    gameState.lastProof = proof;
    gameState.phase = 'resolve';
    gameState.resolveDeadline = Date.now() + 5000;
    resolveRound(gameState, roll);

    // Game end check moved to checkTimeouts to allow resolve animation to play
    // if (checkGameEnd(gameState)) {
    //     gameState.phase = 'ended';
    // }
    // Note: advanceRound logic is typically called after delay by the client polling or next request in serverless
    // For serverless, we handle "automatic" progression via state checks on read.
}

export function advanceRound(gameState) {
    gameState.round++;
    gameState.commitments = {};
    gameState.lastRoll = null;
    gameState.phase = 'commit';
    gameState.commitDeadline = Date.now() + 25000; // Increased commit time for better UX
}

export function checkTimeouts(gameState) {
    const now = Date.now();

    // Auto-start game
    if (gameState.phase === 'waiting' && now > gameState.startDeadline) {
        if (gameState.players.length > 0) {
            gameState.round = 1;
            gameState.phase = 'commit';
            gameState.commitDeadline = now + 25000;
        }
    }

    // Auto-resolve round
    if (gameState.phase === 'commit' && now > gameState.commitDeadline) {
        gameState.players.forEach(p => {
            if (!gameState.commitments[p.id]) gameState.commitments[p.id] = { card: null, skip: true };
        });
        performRoll(gameState);
    }

    // Auto-advance round (serverless trick: check on read if we should have advanced)
    if (gameState.phase === 'resolve' && now > gameState.resolveDeadline) {
        if (gameState.phase !== 'ended') {
            if (checkGameEnd(gameState)) {
                gameState.phase = 'ended';
            } else {
                advanceRound(gameState);
            }
        }
    }
}

export function getPublicState(gameState, currentPlayerId) {
    // ALWAYS run checkTimeouts before returning state to simulate "active" server
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
