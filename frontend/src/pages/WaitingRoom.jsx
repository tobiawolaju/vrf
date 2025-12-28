import React from 'react';
import PlayerBadge from '../components/PlayerBadge';
import './WaitingRoom.css';

const WaitingRoom = ({ gameState }) => {
    return (
        <div className="waiting-room-container">
            <div className="setup-screen">
                <h1>Game Lobby</h1>
                <p className="game-code-display">Code: <strong>{gameState.id}</strong></p>

                <div className="players-list">
                    <h3>Players Joined</h3>
                    <div className="avatar-row">
                        {gameState.players.map((p, idx) => (
                            <PlayerBadge key={p.id || idx} player={p} />
                        ))}
                    </div>
                </div>

                <div className="countdown-timer big">
                    Match starts in: <span className="time">{mins}m {secs.toString().padStart(2, '0')}s</span>
                </div>

                <div className="info-box">
                    <p>Invite friends using the code above!</p>
                </div>
            </div>
        </div>
    );
};

export default WaitingRoom;











