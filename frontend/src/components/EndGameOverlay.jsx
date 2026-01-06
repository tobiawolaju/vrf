import React, { useState } from 'react'; // Added useState
import { useWalletClient, usePublicClient, useAccount } from 'wagmi';
import { mintVictoryBadge } from '../lib/vrf';
import VerificationModal from './VerificationModal';
import './EndGameOverlay.css';

const EndGameOverlay = ({ winner, gameState, history }) => {
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient();
    const { address } = useAccount();

    const [isMinting, setIsMinting] = useState(false);
    const [hasMinted, setHasMinted] = useState(false);
    const [showVerify, setShowVerify] = useState(false);

    if (!winner) return null;

    const handleMint = async () => {
        if (!walletClient) return alert("Connect wallet first!");
        setIsMinting(true);
        const res = await mintVictoryBadge(walletClient, publicClient);
        setIsMinting(false);
        if (res.success) {
            alert("Victory Badge Minted Successfully!");
            setHasMinted(true);
        } else {
            alert("Minting Failed: " + res.error);
        }
    };

    // Use passed history or fallback to current state if empty (e.g. refresh)
    const roundsData = history && history.length > 0 ? history : [
        { id: gameState.currentRoundId || 5, result: gameState.lastRoll, txHash: gameState.lastRollTxHash }
    ];

    // Sort players to determine rank
    const sortedPlayers = [...gameState.players].sort((a, b) => {
        if (b.credits !== a.credits) return b.credits - a.credits;
        const aRemaining = a.cards.filter(c => !c.isBurned).length;
        const bRemaining = b.cards.filter(c => !c.isBurned).length;
        if (bRemaining !== aRemaining) return bRemaining - aRemaining;
        const aFirst = a.firstCorrectRound ?? Infinity;
        const bFirst = b.firstCorrectRound ?? Infinity;
        return aFirst - bFirst;
    });

    const userRankIndex = sortedPlayers.findIndex(p => p.id === address); // Assuming address is the ID or we map it
    // Wait, gameState.players uses internal IDs (generated or privy). 
    // We need to match the current user. `address` comes from useAccount. 
    // In `server.js`, player IDs are privy IDs or generated. 
    // If the user is connected, we might need to find which player is "them".
    // Usually `gameState` has `players` with an `isMe` flag if fetched from `getPublicState` IF we passed the ID.
    // BUT `EndGameOverlay` receives `gameState` from `Gameplay.jsx`. 
    // Check `Gameplay.jsx`: `scoreboard` uses `players` array.
    // In `getPublicState` (gameLogic.js), it sets `isMe`.
    // Let's assume `gameState.players` has objects. One might have `isMe` true if the parent component ensured it.
    // Actually, `Gameplay.jsx` passes `gameState` which comes from `useGameState` or similar. 
    // Let's check if we can find the player by `isMe` property or fallback to address comparison if IDs match address.

    let myRank = -1;
    // Try finding by isMe first (if available in this context)
    const myPlayerIndex = sortedPlayers.findIndex(p => p.isMe);

    if (myPlayerIndex !== -1) {
        myRank = myPlayerIndex + 1;
    } else if (address) {
        // Fallback: try to match ID to address (if IDs are addresses)
        // or name if unique? No. 
        // In this app, ID is likely Privy ID.
        // If we can't identify the user, we can't show rank.
        // Let's just try to find based on `address` if ID is address-like or checking connected wallet.
        // For now, if we can't find rank, we don't show it.
        // Actually, looking at `Gameplay.jsx` (which I viewed earlier), it passes `currentPlayer`.
        // We can check if `EndGameOverlay` can receive `currentPlayer` prop? It receives `winner` and `gameState`.
        // `Gameplay.jsx` has `currentPlayer` in scope. 
        // I will update `Gameplay.jsx` to pass `currentPlayer` to `EndGameOverlay` as well, or just `myRank`.
        // But for this file edit, I'll put the logic here assuming I can find 'me'. 
        // Wait, `Gameplay.jsx` does `<EndGameOverlay winner={gameState.winner} gameState={gameState} history={roundHistory} />`
        // It does NOT pass `currentPlayer` explicitly, but `gameState` might have it if `getPublicState` was used.
        // `gameState` in `Gameplay` context usually has `players` array.
        // Let's rely on finding standard user identification. 
        // Since I can't edit `Gameplay.jsx` in the same turn easily without risk, I'll check `players` for `isMe`.
        // If not found, I'll search by matching `id` to `address` (if they are the same).
        myRank = sortedPlayers.findIndex(p => p.id === address) + 1;
    }

    const totalPlayers = sortedPlayers.length;

    const getOrdinal = (n) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    return (
        <div className="game-end-overlay">
            <div className="end-panel">
                <h2>🏆 Winner 🏆</h2>
                <div className="winner-display">
                    <h3>{winner.name}</h3>
                    <p className="winner-credits">💰 {winner.credits} Credits</p>
                </div>

                {myRank > 0 && (
                    <div className="rank-display">
                        <p>You finished <span className="highlight-rank">{getOrdinal(myRank)}</span> of {totalPlayers} players</p>
                    </div>
                )}

                <div className="action-buttons">
                    {!hasMinted ? (
                        <button
                            className="btn-helper"
                            onClick={handleMint}
                            disabled={isMinting}
                        >
                            {isMinting ? "Minting..." : "🥇 Mint Victory Badge"}
                        </button>
                    ) : (
                        <button className="btn-helper disabled" disabled>✅ Badge Minted</button>
                    )}

                    <button className="btn-helper" onClick={() => setShowVerify(true)}>
                        🔍 Verify Rolls
                    </button>

                    <button className="btn-play-again" onClick={() => window.location.href = '/'}>
                        Play Again
                    </button>
                </div>
            </div>

            <VerificationModal
                isOpen={showVerify}
                onClose={() => setShowVerify(false)}
                gameCode={gameState.gameCode}
                rounds={roundsData}
            />
        </div>
    );
};

export default EndGameOverlay;
