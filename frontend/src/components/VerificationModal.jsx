import React from 'react';
import './VerificationModal.css';

const VerificationModal = ({ isOpen, onClose, gameCode, rounds }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content retro-border">
                <div className="modal-header">
                    <h2>🔍 Game Verification</h2>
                    <button onClick={onClose} className="close-btn">X</button>
                </div>
                <div className="modal-body">
                    <p className="game-id">Game ID: <span>{gameCode}</span></p>

                    <div className="rounds-list">
                        {rounds.map((round) => (
                            <div key={round.id} className="round-item">
                                <div className="round-info">
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span className="round-num">Round {round.id}</span>
                                        <span className="round-id-raw">#{round.id.toString().slice(0, 8)}...</span>
                                    </div>
                                </div>
                                <span className="round-result">🎲 {round.result}</span>
                                <div className="round-links">
                                    {round.txHash ? (
                                        <a
                                            href={`https://explorer.monad-testnet.devnet.monad.xyz/tx/${round.txHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="verify-link"
                                        >
                                            View TX ↗
                                        </a>
                                    ) : (
                                        <span className="pending">Pending...</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerificationModal;
