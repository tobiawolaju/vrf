import React from 'react';
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

            <div className="scoreboard-corner">
                <h3>Scoreboard</h3>
                {gameState.players
                    .sort((a, b) => b.credits - a.credits)
                    .map((player, idx) => (
                        <div key={player.id} className={`score-item ${player.isMe ? 'me' : ''}`}>
                            <span className="rank">#{idx + 1}</span>
                            <div className="player-avatar-small">
                                <span>{player.avatar || '👤'}</span>
                            </div>
                            <span className="name">{player.name}</span>
                            <span className="credits">💰 {player.credits}</span>
                        </div>
                    ))}
            </div>

            <div className="top-center-info">
                <div className="round-badge">Round {gameState.round}/5</div>
                {gameState.phase === 'commit' && (
                    <div className="center-timer">
                        <span className="timer-text">{timeLeft}s remaining</span>
                    </div>
                )}
                {gameState.phase === 'resolve' && !isRolling && (
                    <div className="vrf-section">
                        <div className="round-outcome">
                            {(() => {
                                const myCommit = gameState.currentPlayer?.commitment;
                                if (!myCommit || myCommit.skip) return <span className="outcome-text skip">Round Skipped</span>;
                                if (myCommit.card === gameState.lastRoll) return <span className="outcome-text win">WINNER!</span>;
                                return <span className="outcome-text loss">BURNED!</span>;
                            })()}
                        </div>
                        <span className="sub-text">Next round in {resolveTimeLeft}s...</span>
                    </div>
                )}
            </div>

            <div className="game-center">
                <div className="die-area" onDragOver={handleDragOver} onDrop={handleDrop}>
                    {(gameState.phase === 'resolve' || isRolling) && (
                        <div className="die-display">
                            <div className={`die-cube ${isRolling ? 'rolling' : ''}`}>
                                {(() => {
                                    const diceIcons = ['⚀', '⚁', '⚂'];
                                    return diceIcons[visualRoll - 1] || visualRoll;
                                })()}
                            </div>
                        </div>
                    )}
                    {currentPlayer?.hasCommitted && gameState.phase === 'commit' && (
                        <div className="waiting-message">
                            <p>✓ Recorded</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="player-hand">
                <div className="hand-label">Your Hand</div>
                <div className="cards-container">
                    {currentPlayer && (
                        <>
                            {currentPlayer.cards.map((cardItem, idx) => {
                                const cardValue = cardItem.value;
                                const isBurned = cardItem.isBurned;
                                const isSelected = selectedCard !== null && cardValue === selectedCard;

                                const total = currentPlayer.cards.length;
                                const mid = (total - 1) / 2;
                                const rotate = (idx - mid) * 10;
                                const translateY = Math.abs(idx - mid) * 5;

                                return (
                                    <div
                                        key={cardValue}
                                        className={`hand-card ${isSelected ? 'selected' : ''} ${isBurned ? 'burned' : ''} ${!canCommit ? 'disabled' : ''}`}
                                        style={{
                                            transform: `rotate(${rotate}deg) translateY(${translateY}px) ${isSelected ? 'translateY(-20px)' : ''}`,
                                            zIndex: isSelected ? 100 : idx
                                        }}
                                        onClick={() => canCommit && !isBurned && handleCardClick(cardValue)}
                                    >
                                        <img src={`/card${cardValue}.png`} alt={`Card ${cardValue}`} />
                                    </div>
                                );
                            })}
                            {(gameState.phase === 'commit' || gameState.phase === 'resolve') && (
                                <div
                                    className={`skip-button ${selectedCard === null && currentPlayer.hasCommitted ? 'selected' : ''} ${gameState.phase === 'resolve' ? 'disabled' : ''}`}
                                    style={{
                                        transform: `rotate(${(currentPlayer.cards.length - ((currentPlayer.cards.length - 1) / 2)) * 10}deg) translateY(${Math.abs(currentPlayer.cards.length - ((currentPlayer.cards.length - 1) / 2)) * 5}px) ${selectedCard === null && currentPlayer.hasCommitted ? 'translateY(-20px)' : ''}`,
                                        zIndex: (selectedCard === null && currentPlayer.hasCommitted) ? 100 : 200
                                    }}
                                    onClick={() => gameState.phase === 'commit' && handleSkip()}
                                >
                                    <img src="/card4.png" alt="Skip" />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {gameState.phase === 'ended' && gameState.winner && (
                <div className="game-end-overlay">
                    <div className="end-panel">
                        <h2>🏆 Results</h2>
                        <div className="winner-display">
                            <h3>{gameState.winner.name} Wins!</h3>
                            <p>💰 {gameState.winner.credits} credits</p>
                        </div>
                        <button className="btn-primary" onClick={() => window.location.href = '/'}>
                            Play Again
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Gameplay;
