import React from 'react';
import './VoteTracker.css';

const VoteTracker = ({
    gameState,
    debugRolling,
    setDebugRolling,
    triggerVRF
}) => {
    const committedCount = gameState.players.filter(p => p.hasCommitted).length;
    const totalPlayers = gameState.players.length;

    return (
        <div className="vote-tracker-container">
            <div className="vote-status">
                <span className="count">{committedCount}/{totalPlayers}</span>
                <span className="label">voted</span>
            </div>

            <div className="debug-controls">
                <button
                    className="debug-btn test-dice"
                    onClick={() => setDebugRolling(!debugRolling)}
                >
                    {debugRolling ? 'Stop Dice' : 'Test Dice'}
                </button>
                <button
                    className="debug-btn vrf-trigger"
                    onClick={triggerVRF}
                >
                    On-Chain Roll
                </button>
            </div>
        </div>
    );
};

export default VoteTracker;
