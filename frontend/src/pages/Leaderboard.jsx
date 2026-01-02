import React, { useEffect, useState } from 'react';
import './Leaderboard.css';

const Leaderboard = ({ setView }) => {
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await fetch('/api/leaderboard');
                if (res.ok) {
                    const data = await res.json();
                    setPlayers(data);
                }
            } catch (err) {
                console.error("Failed to fetch leaderboard", err);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    return (
        <div className="home-container">
            <div className="leaderboard-card">
                <button className="btn-back-home" onClick={() => setView('home')}>
                    ← BACK
                </button>

                <h1 className="leaderboard-title">🏆 Hall of Fame</h1>

                {loading ? (
                    <div className="loading-spinner">Loading...</div>
                ) : players.length === 0 ? (
                    <div className="empty-state">No matches recorded yet. Be the first!</div>
                ) : (
                    <div className="leaderboard-list">
                        <div className="leaderboard-row header">
                            <span className="rank">#</span>
                            <span className="player">Player</span>
                            <span className="winrate">Win Rate</span>
                        </div>
                        {players.map((player) => (
                            <div key={player.rank} className="leaderboard-row">
                                <span className={`rank rank-${player.rank}`}>{player.rank}</span>
                                <span className="player">
                                    {player.name.startsWith('@') ? player.name : `@${player.name}`}
                                </span>
                                <span className="winrate">{player.winRate}%</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Leaderboard;
