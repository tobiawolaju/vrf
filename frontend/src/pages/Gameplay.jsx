import React from 'react';
import Scoreboard from '../components/Scoreboard';
import Dice3D from '../components/Dice3D';
import PlayerHand from '../components/PlayerHand';
import RoundStatus from '../components/RoundStatus';
import EndGameOverlay from '../components/EndGameOverlay';
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
    const canCommit = currentPlayer && currentPlayer.cards.some(c => !c.isBurned) && gameState.phase === 'commit';

    return (
        <div className="gameplay-container">

            <div className="vote-tracker-corner">
                {gameState.players.filter(p => p.hasCommitted).length}/{gameState.players.length} voted

            </div>

            <Scoreboard players={gameState.players} />

            <RoundStatus
                round={gameState.round}
                phase={gameState.phase}
                timeLeft={timeLeft}
                resolveTimeLeft={resolveTimeLeft}
                isRolling={isRolling}
                lastRoll={gameState.lastRoll}
                currentUserCommitment={gameState.currentPlayer?.commitment}
            />

            <div className="game-center">
                {(gameState.phase === 'resolve' || isRolling) && (
                    <Dice3D
                        roll={visualRoll}
                        isRolling={isRolling}
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
