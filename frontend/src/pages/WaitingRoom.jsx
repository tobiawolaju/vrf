import React from 'react';
import './WaitingRoom.css';

const WaitingRoom = ({ gameState, waitTimeLeft, gameCode }) => {
    const mins = Math.floor(waitTimeLeft / 60);
    const secs = waitTimeLeft % 60;

    return (
        <div className="waiting-room-container">
            <div className="setup-screen">
                <div className="countdown-timer big">
                    Match starts in: <span className="time">{mins}m {secs.toString().padStart(2, '0')}s</span>
                </div>
                <div className="players-list">
                    <div className="avatar-row">
                        {gameState.players.map((p, idx) => (
                            <div key={idx} className="player-bubble" title={p.name}>
                                <div className="bubble-avatar">
                                    {p.avatar && p.avatar.startsWith('http') ? (
                                        <img src={p.avatar} alt={p.name} className="avatar-img" />
                                    ) : (
                                        <span>{p.avatar || '👤'}</span>
                                    )}
                                </div>
                                <span className="bubble-name">{p.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="info-box">
                    <p>             <strong>{gameState.players.length} Nads </strong>
                        waiting, Invite more people using code: <strong>{gameCode}</strong></p>
                </div>
            </div>
        </div>
    );
};

export default WaitingRoom;