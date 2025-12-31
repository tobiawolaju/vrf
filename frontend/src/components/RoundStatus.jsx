import React from 'react';
import './RoundStatus.css';

const RoundStatus = ({ round, phase, timeLeft, resolveTimeLeft, isRolling, lastRoll, currentUserCommitment, lastRollTxHash }) => {
    return (
        <div className="top-center-info">
            <div className="round-badge">Round {round}/5</div>

            {phase === 'commit' && (
                <div className="center-timer">
                    <span className="timer-text">{timeLeft}s remaining</span>
                </div>
            )}

            {phase === 'rolling' && (
                <div className="center-timer">
                    <span className="timer-text">🎲 Requesting VRF...</span>
                </div>
            )}

            {phase === 'resolve' && !isRolling && (
                <div className="vrf-section">
                    <div className="round-outcome">
                        {(() => {
                            if (!currentUserCommitment || currentUserCommitment.skip)
                                return <span className="outcome-text skip">Round Skipped</span>;
                            if (currentUserCommitment.card === lastRoll)
                                return <span className="outcome-text win">WINNER!</span>;
                            return <span className="outcome-text loss">BURNED!</span>;
                        })()}
                    </div>
                    <span className="sub-text">Next round in {resolveTimeLeft}s...</span>
                    {lastRollTxHash && (
                        <a href={`https://monadvision.com/tx/${lastRollTxHash}`} target="_blank" rel="noreferrer" className="verify-link" style={{ fontSize: '0.8rem', color: '#666', textDecoration: 'none', marginTop: '5px', display: 'block' }}>
                            Verify on Monad ↗
                        </a>
                    )}
                </div>
            )}
        </div>
    );
};

export default RoundStatus;
