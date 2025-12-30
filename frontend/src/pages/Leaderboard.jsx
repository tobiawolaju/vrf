import { useState, useEffect } from 'react';
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
            } catch (error) {
                console.error("Failed to fetch leaderboard:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    return (
        <div className="leaderboard-container">
            <div className="leaderboard-header">
                <h2>🏆 Hall of Valor</h2>
                <button className="btn-close" onClick={() => setView('home')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="leaderboard-content">
                {loading ? (
                    <div className="loading-spinner">Loading...</div>
                ) : players.length === 0 ? (
                    <div className="empty-state">No matches recorded yet. Be the first!</div>
                ) : (
                    <div className="leaderboard-list">
                        <div className="leaderboard-row header">
                            <span className="rank">#</span>
                            <span className="player">Player</span>
                            <span className="stat">Win Rate</span>
                            <span className="stat">Matches</span>
                            <span className="stat">Wins</span>
                        </div>
                        {players.map((player, index) => (
                            <div key={player.id || index} className={`leaderboard-row rank-${index + 1}`}>
                                <span className="rank">{index + 1}</span>
                                <div className="player-info">
                                    <div className="avatar">
                                        {player.avatar && player.avatar.length > 2 ?
                                            <img src={player.avatar} alt="avatar" /> :
                                            (player.avatar || '😊')}
                                    </div>
                                    <span className="name">{player.name}</span>
                                </div>
                                <span className="stat win-rate">
                                    {(player.winRate * 100).toFixed(1)}%
                                </span>
                                <span className="stat">{player.matches_played}</span>
                                <span className="stat">{player.matches_won}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Leaderboard;
