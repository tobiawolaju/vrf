import React, { useState } from 'react'; // Added useState
import { useWalletClient, usePublicClient, useAccount } from 'wagmi';
import { mintVictoryBadge } from '../lib/vrf';
import VerificationModal from './VerificationModal';
import './EndGameOverlay.css';

const EndGameOverlay = ({ winner, gameState }) => {
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient();
    const { address } = useAccount();

    const [isMinting, setIsMinting] = useState(false);
    const [hasMinted, setHasMinted] = useState(false);
    const [showVerify, setShowVerify] = useState(false);

    if (!winner) return null;

    // Detect if current user is the winner
    // Note: winner.id might be internal ID, need to check address or assumption
    // For now, let's assume if they have the wallet connected that matches... 
    // actually winner object doesn't have address usually? 
    // Let's assume ANYONE can verify, only winner can mint.
    // We might need to check player list to map ID to address if needed, 
    // but for now, let's just show button if they are "connected" and maybe let contract fail if wrong person?
    // Better: Check if winner.id matches local variable... but we don't have local playerId here. 
    // Let's just show it.

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

    // Prepare rounds data for verification
    // We need to adhere to format: { id, result, txHash }
    // gameState might not have history of all rounds easily unless we track it or fetch it.
    // Simple workaround: Use whatever we have. 
    // If backend doesn't send history, we might only show "Last Round".
    // Let's assume we can show at least the current round info or nothing for now until we fix backend to send history.
    const roundsMock = [
        { id: gameState.currentRoundId, result: gameState.lastRoll, txHash: gameState.lastRollTxHash }
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
                            className="btn-mint"
                            onClick={handleMint}
                            disabled={isMinting}
                        >
                            {isMinting ? "Minting..." : "🥇 Mint Reward"}
                        </button>
                    ) : (
                        <button className="btn-mint disabled" disabled>✅ Minted</button>
                    )}

                    <button className="btn-verify" onClick={() => setShowVerify(true)}>
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
                rounds={roundsMock}
            />
        </div>
    );
};

export default EndGameOverlay;
