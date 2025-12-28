import React from 'react';
import './EndGameOverlay.css';

const EndGameOverlay = ({ winner }) => {
    if (!winner) return null;

    return (
        <div className="game-end-overlay">
            <div className="end-panel">
                <h2>🏆 Results</h2>
                <div className="winner-display">
                    <h3>{winner.name} Wins!</h3>
                    <p>💰 {winner.credits} credits</p>
                </div>
                <button className="btn-primary" onClick={() => window.location.href = '/'}>
                    Play Again
                </button>
            </div>
        </div>
    );
};

export default EndGameOverlay;
