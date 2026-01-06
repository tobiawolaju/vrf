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

    return (
        <div className="game-end-overlay">
            <div className="end-panel">
                <h2>🏆 Results</h2>
                <div className="winner-display">
                    <h3>{winner.name} Wins!</h3>
                    <p>💰 {winner.credits} credits</p>
                </div>

                <div className="action-buttons">
                    {!hasMinted ? (
                        <button
                            className="btn-helper"
                            onClick={handleMint}
                            disabled={isMinting}
                        >
                            {isMinting ? "Minting..." : "🥇 Mint Reward"}
                        </button>
                    ) : (
                        <button className="btn-helper disabled" disabled>✅ Minted</button>
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
