import React from 'react';
import './RoundStatus.css';

const RoundStatus = ({ round, phase, timeLeft, resolveTimeLeft, isRolling, lastRoll, currentUserCommitment }) => {
    return (
        <div className="top-center-info">
            <div className="round-badge">Round {round}/5</div>

            {phase === 'commit' && (
                <div className="center-timer">
                    <span className="timer-text">{timeLeft}s remaining</span>
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
                </div>
            )}
        </div>
    );
};

export default RoundStatus;
