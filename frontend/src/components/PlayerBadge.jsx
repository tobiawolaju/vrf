import React from 'react';
import Avatar from './Avatar';
import './PlayerBadge.css';

const PlayerBadge = ({ player }) => {
    return (
        <div className="player-badge" title={player.name}>
            <Avatar src={player.avatar} name={player.name} size="large" className="badge-avatar" />
            <span className="badge-name">{player.name}</span>
        </div>
    );
};

export default PlayerBadge;
