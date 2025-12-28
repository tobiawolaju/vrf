import Dropdown from '../components/Dropdown';

const Home = ({ startDelay, setStartDelay, createGame, setView }) => {
    const delayOptions = [
        { value: 1, label: '1 Minute' },
        { value: 30, label: '30 Minutes' },
        { value: 60, label: '1 Hour' }
    ];

    return (
        <div className="home-container">
            <div className="setup-screen">
                <h1>🎲 Last Die Standing</h1>
                <div className="start-settings">
                    <label>
                        Match Start Delay:
                        <Dropdown
                            options={delayOptions}
                            value={startDelay}
                            onChange={(val) => setStartDelay(val)}
                        />
                    </label>
                </div>
                <div className="home-buttons">
                    <button className="btn-primary" onClick={createGame}>Create Match</button>
                    <button className="btn-secondary" onClick={() => setView('join')}>Join Match</button>
                </div>
            </div>
        </div>
    );
};

export default Home;
