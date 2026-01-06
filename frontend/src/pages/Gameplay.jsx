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
    const [roundHistory, setRoundHistory] = React.useState([]);

    React.useEffect(() => {
        let interval;
        if (debugRolling) {
            interval = setInterval(() => {
                setDebugRoll(Math.floor(Math.random() * 3) + 1);
            }, 100);
        }
        return () => clearInterval(interval);
    }, [debugRolling]);

    // Track round history for EndGame verification
    React.useEffect(() => {
        if (gameState.lastRollTxHash && gameState.lastRoll) {
            setRoundHistory(prev => {
                const exists = prev.some(r => r.txHash === gameState.lastRollTxHash);
                if (exists) return prev;
                return [...prev, {
                    id: prev.length + 1, // Simple increment based on captured count
                    result: gameState.lastRoll,
                    txHash: gameState.lastRollTxHash
                }];
            });
        }
    }, [gameState.lastRollTxHash, gameState.lastRoll]);

    const canCommit = currentPlayer && currentPlayer.cards.some(c => !c.isBurned) && gameState.phase === 'commit';

    const triggerVRF = async () => {
        try {
            console.log("🎲 Manually requesting Oracle Roll...");
            const res = await fetch('/api/force-roll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameCode: gameState.gameCode })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Oracle Request Sent!\n\nTx: ${data.txHash}\n\nThe Oracle will now fulfill the request asynchronously. Please wait for the result...`);
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            alert(`Failed to trigger: ${err.message}`);
        }
    };

    return (
        <div className="gameplay-container">


            {currentPlayer?.hasCommitted && gameState.phase === 'commit' && (
                <VoteTracker
                    gameState={gameState}
                    debugRolling={debugRolling}
                    setDebugRolling={setDebugRolling}
                    triggerVRF={triggerVRF}
                />
            )}



            <Scoreboard players={gameState.players} hostId={gameState.hostId} />

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

            </div>


            <PlayerHand
                currentPlayer={currentPlayer}
                selectedCard={selectedCard}
                canCommit={canCommit}
                phase={gameState.phase}
                resolveTimeLeft={resolveTimeLeft}
                handleCardClick={handleCardClick}
                handleSkip={handleSkip}
            />

            {gameState.phase === 'ended' && <EndGameOverlay winner={gameState.winner} gameState={gameState} history={roundHistory} />}
        </div>
    );
};

export default Gameplay;
