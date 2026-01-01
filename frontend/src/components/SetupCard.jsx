import React from 'react';
import './SetupCard.css';

const SetupCard = ({ title, children, className = '', onBack }) => {
    return (
        <div className="setup-card-container">
            {onBack && (
                <button className="btn-secondary btn-back-fixed" onClick={onBack}>
                    ← Back
                </button>
            )}
            <div className={`setup-card ${className}`}>
                {title && <h1>{title}</h1>}
                {children}
            </div>
        </div>
    );
};

export default SetupCard;
