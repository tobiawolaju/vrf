import React from 'react';
import './CreateGame.css';

const CreateGame = ({ gameCode, startDelay, setView, setJoinCode }) => {
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    const joinUrl = `${window.location.origin}/?gameCode=${gameCode}`;

    return (
        <div className="home-container">
            <div className="create-game-card">
                <button className="btn-back-home" onClick={() => setView('home')}>
                    ← BACK
                </button>

                <h1 className="create-title">Match Set!</h1>

                <div className="game-code-box">
                    <div className="game-code-label">Join Code</div>
                    <div className="game-code-val">{gameCode}</div>
                </div>

                <div className="share-section">
                    <h3>Share Invite Link:</h3>
                    <div className="share-input-row">
                        <input type="text" value={joinUrl} readOnly onClick={(e) => e.target.select()} />
                        <button className="btn-copy" onClick={() => copyToClipboard(joinUrl)}>COPY</button>
                    </div>
                </div>

                <div className="info-box">
                    <p>💡 Unlimited players can join.</p>
                    <p>🎮 Starts in {startDelay} {startDelay === 1 ? 'minute' : 'minutes'}.</p>
                </div>

                <button className="btn-join-match" onClick={() => { setJoinCode(gameCode); setView('join'); }}>
                    ENTER LOBBY
                </button>
            </div>
        </div>
    );
};

export default CreateGame;
