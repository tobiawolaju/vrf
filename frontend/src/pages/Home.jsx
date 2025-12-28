import Dropdown from '../components/Dropdown';
import SetupCard from '../components/SetupCard';
import './Home.css';

const Home = ({ startDelay, setStartDelay, createGame, setView, login, logout, authenticated, user }) => {
    const delayOptions = [
        { value: 1, label: '1 Minute' },
        { value: 30, label: '30 Minutes' },
        { value: 60, label: '1 Hour' }
    ];

    // Extraction logic similar to App.jsx/WaitingRoom
    const playerName = user?.twitter?.username || user?.wallet?.address?.slice(0, 8) || user?.email?.address?.split('@')[0] || 'Player';
    const avatar = user?.twitter?.profilePictureUrl ||
        user?.google?.profilePictureUrl ||
        user?.github?.profilePictureUrl ||
        user?.linkedAccounts?.find(acc => acc.profilePictureUrl)?.profilePictureUrl ||
        '😊';

    // Find wallets
    const ethWallet = user?.linkedAccounts?.find(acc => acc.type === 'wallet' && acc.chainType === 'ethereum')?.address;
    const solWallet = user?.linkedAccounts?.find(acc => acc.type === 'wallet' && acc.chainType === 'solana')?.address;

    return (
        <SetupCard title="🎲 Last Die Standing">
            {!authenticated ? (
                <div className="home-buttons">
                    <p className="login-prompt">Please log in to play</p>
                    <button className="btn-primary" onClick={login}>Log In / Sign Up</button>
                </div>
            ) : (
                <>
                    <div className="user-profile">
                        <div className="user-avatar">{avatar.length > 2 ? <img src={avatar} alt="pfp" /> : avatar}</div>
                        <div className="user-info">
                            <span className="user-name">@{playerName}</span>
                            <div className="user-wallets">
                                {ethWallet && (
                                    <div className="wallet-tag eth">
                                        <span className="wallet-icon">Ξ</span>
                                        <span className="wallet-address">{ethWallet.slice(0, 6)}...{ethWallet.slice(-4)}</span>
                                    </div>
                                )}
                                {solWallet && (
                                    <div className="wallet-tag sol">
                                        <span className="wallet-icon">◎</span>
                                        <span className="wallet-address">{solWallet.slice(0, 4)}...{solWallet.slice(-4)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button className="btn-logout" onClick={logout} title="Logout">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                            </svg>
                        </button>
                    </div>

                    <div className="home-settings">
                        <label>
                            Match Start Delay
                            <Dropdown
                                options={delayOptions}
                                value={startDelay}
                                onChange={(val) => setStartDelay(val)}
                            />
                        </label>
                    </div>
                    <div className="home-buttons">
                        <button className="btn-primary" onClick={createGame}>Create New Match</button>
                        <button className="btn-secondary" onClick={() => setView('join')}>Join Existing Match</button>
                    </div>
                </>
            )}
        </SetupCard>
    );
};

export default Home;
