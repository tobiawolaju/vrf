import React from 'react';
import './JoinGame.css';

const JoinGame = ({ joinCode, setJoinCode, joinPlayerName, setJoinPlayerName, playerAvatar, setPlayerAvatar, joinGame, setView }) => {

    const emojiOptions = ['😊', '😎', '🤓', '🥳', '🤩', '😇', '🤠', '🥸', '🤡', '👻', '🤖', '👽', '🦄', '🐶', '🐱', '🐼', '🦊', '🐸'];

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
                    <label>
                        Your Name:
                        <input type="text" value={joinPlayerName} onChange={(e) => setJoinPlayerName(e.target.value)} placeholder="Player Name" onKeyPress={(e) => e.key === 'Enter' && joinGame()} />
                    </label>

                    <div className="avatar-selector">
                        <label>Choose Avatar:</label>
                        <div className="emoji-grid">
                            {emojiOptions.map((emoji) => (
                                <div
                                    key={emoji}
                                    className={`emoji-option ${playerAvatar === emoji ? 'selected' : ''}`}
                                    onClick={() => setPlayerAvatar(emoji)}
                                >
                                    {emoji}
                                </div>
                            ))}
                        </div>
                    </div>

                    <button className="btn-primary" onClick={joinGame}>Join Now</button>
                    <button className="btn-secondary" onClick={() => setView('home')}>Back</button>
                </div>
            </div>
        </div>
    );
};

export default JoinGame;
