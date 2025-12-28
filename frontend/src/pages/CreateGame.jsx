import React from 'react';
import SetupCard from '../components/SetupCard';
import './CreateGame.css';

const CreateGame = ({ gameCode, startDelay, setView, setJoinCode }) => {
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    const joinUrl = `${window.location.origin}/?gameCode=${gameCode}`;

    return (
        <SetupCard title="🎲 Match Set!" className="create-game-card">
            <p className="game-code">Join Code: <strong>{gameCode}</strong></p>
            <div className="join-links">
                <h3>Share this link to invite players:</h3>
                <div className="single-link-container">
                    <input type="text" value={joinUrl} readOnly onClick={(e) => e.target.select()} />
                    <button className="btn-copy" onClick={() => copyToClipboard(joinUrl)}>Copy Link</button>
                </div>
            </div>
            <div className="info-box">
                <p>💡 Unlimited players can join before the timer ends.</p>
                <p>🎮 Match starts automatically in {startDelay} {startDelay === 1 ? 'minute' : 'minutes'}.</p>
            </div>
            <div className="host-actions">
                <button className="btn-secondary" onClick={() => { setJoinCode(gameCode); setView('join'); }}>
                    Join Your Match
                </button>
            </div>
        </SetupCard>
    );
};

export default CreateGame;
