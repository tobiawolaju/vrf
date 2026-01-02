import React from 'react';
import './JoinGame.css';

const JoinGame = ({ joinCode, setJoinCode, joinGame, setView, login, authenticated }) => {

    return (
        <div className="home-container">
            <div className="join-card">
                <button className="btn-back-home" onClick={() => setView('home')}>
                    ← BACK
                </button>

                <h1 className="join-title">Join Match</h1>

                <input
                    className="join-input"
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="CODE"
                    maxLength={6}
                />

                {!authenticated ? (
                    <button className="btn-join-action" onClick={login}>LOG IN FIRST</button>
                ) : (
                    <button className="btn-join-action" onClick={joinGame}>ENTER GAME</button>
                )}
            </div>
        </div>
    );
};

export default JoinGame;
