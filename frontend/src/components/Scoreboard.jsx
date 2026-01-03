import React from 'react';
import Avatar from './Avatar';
import './Scoreboard.css';

const Scoreboard = ({ players }) => {
    // Generate stable random color from name
    const getUserColor = (name) => {
        const colors = [
            '#FF0000', // Red
            '#00FF00', // Green
            '#0000FF', // Blue
            '#B22222', // FireBrick
            '#FF7F50', // Coral
            '#9ACD32', // YellowGreen
            '#FF4500', // OrangeRed
            '#2E8B57', // SeaGreen
            '#DAA520', // GoldenRod
            '#D2691E', // Chocolate
            '#5F9EA0', // CadetBlue
            '#1E90FF', // DodgerBlue
            '#8A2BE2', // BlueViolet
            '#FF69B4', // HotPink
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <div className="scoreboard-corner">
            <h3>Live score</h3>
            <div className="score-list">
                {players
                    .sort((a, b) => b.credits - a.credits)
                    .map((player, idx) => (
                        <div key={player.id} className={`score-item ${player.isMe ? 'me' : ''}`}>
                            <span className="rank">#{idx + 1}</span>
                            <Avatar src={player.avatar} name={player.name} size="small" />
                            <span
                                className="name"
                                style={{ color: player.isMe ? undefined : getUserColor(player.name) }}
                            >
                                {player.name}
                            </span>
                            <strong className="credits"> {player.credits}</strong>
                        </div>
                    ))}
            </div>
        </div>
    );
};

export default Scoreboard;
