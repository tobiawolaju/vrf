import Dropdown from '../components/Dropdown';
import './Home.css';

const Home = ({ startDelay, setStartDelay, createGame, setView, login, authenticated }) => {
    const delayOptions = [
        { value: 1, label: '1 Minute' },
        { value: 30, label: '30 Minutes' },
        { value: 60, label: '1 Hour' }
    ];

    return (
        <div className="home-container">
            <div className="setup-screen">
                <h1>🎲 Last Die Standing</h1>

                {!authenticated ? (
                    <div className="home-buttons">
                        <p className="login-prompt">Please log in to play</p>
                        <button className="btn-primary" onClick={login}>Log In / Sign Up</button>
                    </div>
                ) : (
                    <>
                        <div className="start-settings">
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
            </div>
        </div>
    );
};

export default Home;
