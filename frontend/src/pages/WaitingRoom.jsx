import React from 'react';
import PlayerBadge from '../components/PlayerBadge';
import './WaitingRoom.css';

const WaitingRoom = ({ gameState, waitTimeLeft, gameCode }) => {
    const mins = Math.floor(waitTimeLeft / 60);
    const secs = waitTimeLeft % 60;

    return (
        <div className="home-container">
            <div className="lobby-card">
                <button className="btn-back-home" onClick={() => setView('home')}>
                    ← ESCAPE
                </button>
                <div className="lobby-header">
                    <h1 className="lobby-title">Lobby</h1>
                    <div className="game-code-pill">CODE: {gameCode}</div>
                </div>

                <div className="players-section">
                    <h3>Players Joined</h3>
                    <div className="avatar-grid">
                        {gameState.players.map((p, idx) => (
                            <PlayerBadge key={p.id || idx} player={p} />
                        ))}
                    </div>
                </div>

                <div className="countdown-box">
                    <div className="countdown-label">Match Starts In</div>
                    <div className="countdown-time">
                        {mins}:{secs.toString().padStart(2, '0')}
                    </div>
                </div>

                <div className="lobby-info">
                    Waiting for players to join...
                </div>
            </div>
        </div>
    );
};

export default WaitingRoom;































