import React from 'react';
import './PlayerHand.css';

const PlayerHand = ({ currentPlayer, selectedCard, canCommit, phase, handleCardClick, handleSkip }) => {
    if (!currentPlayer) return null;

    return (
        <div className="player-hand">
            <div className="hand-label">Your Hand</div>
            <div className="cards-container">
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
                {(phase === 'commit' || phase === 'resolve') && (
                    <div
                        className={`skip-button ${selectedCard === null && currentPlayer.hasCommitted ? 'selected' : ''} ${phase === 'resolve' ? 'disabled' : ''}`}
                        style={{
                            transform: `rotate(${(currentPlayer.cards.length - ((currentPlayer.cards.length - 1) / 2)) * 10}deg) translateY(${Math.abs(currentPlayer.cards.length - ((currentPlayer.cards.length - 1) / 2)) * 5}px) ${selectedCard === null && currentPlayer.hasCommitted ? 'translateY(-20px)' : ''}`,
                            zIndex: (selectedCard === null && currentPlayer.hasCommitted) ? 100 : 200
                        }}
                        onClick={() => phase === 'commit' && handleSkip()}
                    >
                        <img src="/card4.png" alt="Skip" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerHand;
