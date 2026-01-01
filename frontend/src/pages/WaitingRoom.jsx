import React from 'react';
import PlayerBadge from '../components/PlayerBadge';
import SetupCard from '../components/SetupCard';
import './WaitingRoom.css';

const WaitingRoom = ({ gameState, waitTimeLeft, gameCode }) => {
    const mins = Math.floor(waitTimeLeft / 60);
    const secs = waitTimeLeft % 60;

    return (
        <SetupCard title="Game Lobby" className="waiting-room-card">
            <p className="game-code-display">Code: <strong>{gameCode}</strong></p>

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
        </SetupCard>
    );
};

export default WaitingRoom;































