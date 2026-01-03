import crypto from 'crypto';

export function generateGameCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function generatePlayerId() {
    return Math.random().toString(36).substring(2, 15);
}

export function initializeGame(startDelayMinutes = 1) {
    const gameCode = generateGameCode();
    const startDeadline = Date.now() + startDelayMinutes * 60 * 1000;

    return {
        gameCode,
        players: [],
        round: 0, // round being resolved
        phase: 'waiting',
        commitDeadline: null,
        resolveDeadline: null,
        startDeadline,
        lastRoll: null,
        lastSeed: null,
        lastProof: null,
        commitments: {},
        joinedCount: 0
    };
}

export function determineWinner(gameState) {
    const sorted = [...gameState.players].sort((a, b) => {
        if (b.credits !== a.credits) return b.credits - a.credits;

        const aRemaining = a.cards.filter(c => !c.isBurned).length;
        const bRemaining = b.cards.filter(c => !c.isBurned).length;
        if (bRemaining !== aRemaining) return bRemaining - aRemaining;

        const aFirst = a.firstCorrectRound ?? Infinity;
        const bFirst = b.firstCorrectRound ?? Infinity;
        return aFirst - bFirst;
    });

    return sorted[0] || null;
}

export function checkGameEnd(gameState) {
    const playersWithCards = gameState.players.filter(p =>
        p.cards.some(c => !c.isBurned)
    );
    return playersWithCards.length === 0;
}

// VRF Logic removed - migrated to Switchboard On-Chain


/**
 * Resolves a round, updating scores, burning cards, and advancing phase.
 */
export function resolveRound(gameState, roll, txHash) {
    gameState.lastRoll = Number(roll);
    gameState.lastRollTxHash = txHash || null;
    gameState.rollRequested = false;
    gameState.phase = 'resolve';
    gameState.resolveDeadline = Date.now() + 5000; // 5s to show result

    gameState.players.forEach(player => {
        const commitment = gameState.commitments[player.id];
        if (!commitment || commitment.skip) return;

        const selectedCard = commitment.card;

        if (selectedCard === roll) {
            player.credits += 1;
            if (player.firstCorrectRound == null) {
                player.firstCorrectRound = gameState.round;
            }
        } else {
            const card = player.cards.find(
                c => c.value === selectedCard && !c.isBurned
            );
            if (card) card.isBurned = true;
        }
    });
}

export function performRoll(gameState) {
    // Deprecated: Logic moved to server.js (on-chain trigger)
    // We keep this function stub to prevent crashes if called by legacy checkTimeouts
    return;
}

export function advanceRound(gameState) {
    // Check if game should end
    const gameEnded = checkGameEnd(gameState) || gameState.round >= 5;

    if (gameEnded) {
        gameState.phase = 'ended';
        return;
    }

    gameState.round++;
    gameState.commitments = {};
    gameState.lastRoll = null;
    gameState.currentRoundId = null; // Clear for next round
    gameState.phase = 'commit';
    gameState.commitDeadline = Date.now() + 25000;
}

export function checkTimeouts(gameState) {
    const now = Date.now();

    if (gameState.phase === 'waiting' && now > gameState.startDeadline) {
        if (gameState.players.length > 0) {
            gameState.round = 1;
            gameState.phase = 'commit';
            gameState.commitDeadline = now + 25000;
        }
    }

    if (gameState.phase === 'commit' && now > gameState.commitDeadline) {
        gameState.players.forEach(p => {
            if (!gameState.commitments[p.id]) {
                gameState.commitments[p.id] = { card: null, skip: true };
            }
        });
        performRoll(gameState);
    }

    if (gameState.phase === 'resolve' && now > gameState.resolveDeadline) {
        if (gameState.phase !== 'ended') {
            advanceRound(gameState);
        }
    }
}

export function getPublicState(gameState, currentPlayerId) {
    // Moved checkTimeouts to centralized server crank to avoid distributed race conditions
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
            commitment:
                gameState.phase === 'resolve'
                    ? gameState.commitments[p.id]
                    : null,
            isMe: p.id === currentPlayerId
        })),
        currentPlayer: currentPlayer
            ? {
                ...currentPlayer,
                hasCommitted:
                    gameState.commitments[currentPlayer.id] !== undefined,
                commitment:
                    gameState.commitments[currentPlayer.id] || null
            }
            : null,
        round: gameState.round,
        phase: gameState.phase,
        currentRoundId: gameState.currentRoundId, // Required for VRF orchestration
        commitDeadline: gameState.commitDeadline,
        resolveDeadline: gameState.resolveDeadline,
        startDeadline: gameState.startDeadline,
        lastRoll: gameState.lastRoll,
        lastRollTxHash: gameState.lastRollTxHash,
        serverTime: Date.now(),
        winner:
            gameState.phase === 'ended'
                ? determineWinner(gameState)
                : null
    };
}
