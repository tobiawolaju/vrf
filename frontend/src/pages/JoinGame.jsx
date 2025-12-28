import React from 'react';
import './JoinGame.css';

const JoinGame = ({ joinCode, setJoinCode, joinGame, setView, login, authenticated }) => {

    return (
        <div className="join-game-container">
            <div className="setup-screen">
                <h1>🎲 Enter Game</h1>
                <div className="join-form">
                    {!joinCode && (
                        <label>
                            Game Code:
                            <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Enter Code" />
                        </label>
                    )}
                    {joinCode && (
                        <div className="code-display">
                            Joining Game: <strong>{joinCode}</strong>
                        </div>
                    )}

                    {!authenticated ? (
                        <button className="btn-primary" onClick={login}>Log in to Join</button>
                    ) : (
                        <button className="btn-primary" onClick={joinGame}>Join Now</button>
                    )}
                    <button className="btn-secondary" onClick={() => setView('home')}>Back</button>
                </div>
            </div>
        </div>
    );
};

export default JoinGame;
