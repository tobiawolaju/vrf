import React from 'react';
import PlayerBadge from '../components/PlayerBadge';

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
                    <h3>Players Joined</h3>
                    <div className="avatar-row">
                        {gameState.players.map((p, idx) => (
                            <PlayerBadge key={p.id || idx} player={p} />
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

export default WaitingRoom; yy