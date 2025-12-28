import React from 'react';
import Avatar from './Avatar';
import './Scoreboard.css';

const Scoreboard = ({ players }) => {
    return (
        <div className="scoreboard-corner">
            <h3>Scoreboard</h3>
            <div className="score-list">
                {players
                    .sort((a, b) => b.credits - a.credits)
                    .map((player, idx) => (
                        <div key={player.id} className={`score-item ${player.isMe ? 'me' : ''}`}>
                            <span className="rank">#{idx + 1}</span>
                            <Avatar src={player.avatar} name={player.name} size="small" />
                            <span className="name">{player.name}</span>
                            <strong className="credits"> {player.credits}</strong>
                        </div>
                    ))}
            </div>
        </div>
    );
};

export default Scoreboard;
