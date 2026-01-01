import React from 'react';
import Scoreboard from '../components/Scoreboard';
import Dice3D from '../components/Dice3D';
import PlayerHand from '../components/PlayerHand';
import RoundStatus from '../components/RoundStatus';
import EndGameOverlay from '../components/EndGameOverlay';
import VoteTracker from '../components/VoteTracker';
import './Gameplay.css';

const Gameplay = ({
    gameState,
    currentPlayer,
    timeLeft,
    resolveTimeLeft,
    isRolling,
    visualRoll,
    selectedCard,
    handleCardClick,
    handleSkip,
    handleDragOver,
    handleDrop
}) => {
    const [debugRolling, setDebugRolling] = React.useState(false);
    const [debugRoll, setDebugRoll] = React.useState(1);

    React.useEffect(() => {
        let interval;
        if (debugRolling) {
            interval = setInterval(() => {
                setDebugRoll(Math.floor(Math.random() * 3) + 1);
            }, 100);
        }
        return () => clearInterval(interval);
    }, [debugRolling]);

    const canCommit = currentPlayer && currentPlayer.cards.some(c => !c.isBurned) && gameState.phase === 'commit';

    const triggerVRF = async () => {
        try {
            console.log("🎲 Manually triggering VRF...");
            const res = await fetch('/api/debug-roll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameCode: gameState.gameCode })
            });
            const data = await res.json();
            if (data.success) {
                alert(`VRF Triggered!\nTx: ${data.txHash}\nResult: ${data.result || 'Pending...'}`);
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert(`Failed to trigger: ${err.message}`);
        }
    };

    return (
        <div className="gameplay-container">
            <VoteTracker
                gameState={gameState}
                debugRolling={debugRolling}
                setDebugRolling={setDebugRolling}
                triggerVRF={triggerVRF}
            />

            <Scoreboard players={gameState.players} />

            <RoundStatus
                round={gameState.round}
                phase={gameState.phase}
                timeLeft={timeLeft}
                resolveTimeLeft={resolveTimeLeft}
                isRolling={isRolling}
                lastRoll={gameState.lastRoll}
                lastRollTxHash={gameState.lastRollTxHash}
                currentUserCommitment={gameState.currentPlayer?.commitment}
            />

            <div className="game-center">
                {(gameState.phase === 'resolve' || gameState.phase === 'rolling' || isRolling || debugRolling) && (
                    <Dice3D
                        roll={debugRolling ? debugRoll : visualRoll}
                        isRolling={isRolling || debugRolling}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    />
                )}
                {currentPlayer?.hasCommitted && gameState.phase === 'commit' && (
                    <div className="waiting-message">
                        <p>✓ Recorded</p>
                    </div>
                )}
            </div>

            <PlayerHand
                currentPlayer={currentPlayer}
                selectedCard={selectedCard}
                canCommit={canCommit}
                phase={gameState.phase}
                handleCardClick={handleCardClick}
                handleSkip={handleSkip}
            />

            {gameState.phase === 'ended' && <EndGameOverlay winner={gameState.winner} />}
        </div>
    );
};

export default Gameplay;
