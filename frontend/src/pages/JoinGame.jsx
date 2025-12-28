import React from 'react';
import SetupCard from '../components/SetupCard';
import './JoinGame.css';

const JoinGame = ({ joinCode, setJoinCode, joinGame, setView, login, authenticated }) => {

    return (
        <SetupCard title="🎲 Enter Game" className="join-game-card">
            <div className="join-form">
                <label>
                    Game Code:
                    <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="Enter Code" />
                </label>

                {!authenticated ? (
                    <button className="btn-primary" onClick={login}>Log in to Join</button>
                ) : (
                    <button className="btn-primary" onClick={joinGame}>Join Now</button>
                )}
                <button className="btn-secondary" onClick={() => setView('home')}>Back</button>
            </div>
        </SetupCard>
    );
};

export default JoinGame;
