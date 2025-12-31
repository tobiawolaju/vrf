import React from 'react';
import './PlayerHand.css';

const PlayerHand = ({ currentPlayer, selectedCard, canCommit, phase, handleCardClick, handleSkip }) => {
    if (!currentPlayer) return null;

    const handleMouseMove = (e, idx) => {
        const card = e.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 8;
        const rotateY = (centerX - x) / 8;
        card.style.setProperty('--tilt-x', `${rotateX}deg`);
        card.style.setProperty('--tilt-y', `${rotateY}deg`);
    };

    const handleMouseLeave = (e) => {
        const card = e.currentTarget;
        card.style.setProperty('--tilt-x', `0deg`);
        card.style.setProperty('--tilt-y', `0deg`);
    };

    return (
        <div className="player-hand">
            <div className="hand-label balatro-floating">YOUR HAND</div>
            <div className="cards-container">
                {currentPlayer.cards.map((cardItem, idx) => {
                    const cardValue = cardItem.value;
                    const isBurned = cardItem.isBurned;
                    const isSelected = selectedCard !== null && cardValue === selectedCard;

                    const total = currentPlayer.cards.length;
                    const mid = (total - 1) / 2;
                    const rotate = (idx - mid) * 12; // Wider fan
                    const translateY = Math.abs(idx - mid) * 8;

                    return (
                        <div
                            key={cardValue}
                            className={`hand-card ${isSelected ? 'selected' : ''} ${isBurned ? 'burned' : ''} ${!canCommit ? 'disabled' : ''}`}
                            style={{
                                '--card-rotate': `${rotate}deg`,
                                '--card-translate-y': `${translateY}px`,
                                zIndex: isSelected ? 100 : idx
                            }}
                            onMouseMove={(e) => handleMouseMove(e, idx)}
                            onMouseLeave={handleMouseLeave}
                            onClick={() => canCommit && !isBurned && handleCardClick(cardValue)}
                        >
                            <img src={`/card${cardValue}.png`} alt={`Card ${cardValue}`} />
                            <div className="card-glare" />
                        </div>
                    );
                })}
                {(phase === 'commit' || phase === 'resolve') && (
                    <div
                        className={`skip-button ${selectedCard === null && currentPlayer.hasCommitted ? 'selected' : ''} ${phase === 'resolve' ? 'disabled' : ''}`}
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
