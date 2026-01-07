import React from 'react';
import Scoreboard from '../components/Scoreboard';
import Dice3D from '../components/Dice3D';
import PlayerHand from '../components/PlayerHand';
import RoundStatus from '../components/RoundStatus';
import EndGameOverlay from '../components/EndGameOverlay';
import VoteTracker from '../components/VoteTracker';
import TransitionOverlay from '../components/TransitionOverlay'; // Import added
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
    handleDrop,
    onLeave
}) => {
    const [debugRolling, setDebugRolling] = React.useState(false);
    const [debugRoll, setDebugRoll] = React.useState(1);
    const [roundHistory, setRoundHistory] = React.useState([]);

    // Overlay State
    const [overlayConfig, setOverlayConfig] = React.useState({
        isVisible: false,
        type: 'round',
        message: '1'
    });
    const prevRoundRef = React.useRef(gameState.round);
    const prevPhaseRef = React.useRef(gameState.phase);

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

    // Transition Overlay Logic
    React.useEffect(() => {
        // Detect Round Change
        if (gameState.round !== prevRoundRef.current && gameState.round > 0) {
            setOverlayConfig({
                isVisible: true,
                type: 'round',
                message: gameState.round.toString()
            });
            prevRoundRef.current = gameState.round;
        }

        // Detect Game End
        if (gameState.phase === 'ended' && prevPhaseRef.current !== 'ended') {
            const isWinner = gameState.winner === currentPlayer?.id;
            setOverlayConfig({
                isVisible: true,
                type: isWinner ? 'win' : 'lose',
                message: isWinner ? 'YOU WIN' : 'YOU LOSE'
            });
        }

        // Initial detection for Match Start (optional, if round is 1 and just mounted)
        // logic can be refined if needed

        prevPhaseRef.current = gameState.phase;
    }, [gameState.round, gameState.phase, gameState.winner, currentPlayer]);

    const handleOverlayComplete = () => {
        setOverlayConfig(prev => ({ ...prev, isVisible: false }));
    };

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
            <TransitionOverlay
                isVisible={overlayConfig.isVisible}
                type={overlayConfig.type}
                roundNumber={parseInt(overlayConfig.message) || 1}
                onComplete={handleOverlayComplete}
            />

            {/* Leave Match Button */}
            <button className="btn-leave-match" onClick={onLeave}>
                ✕ LEAVE
            </button>

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