import React from 'react';
import './SetupCard.css';

const SetupCard = ({ title, children, className = '' }) => {
    return (
        <div className="setup-card-container">
            <div className={`setup-card ${className}`}>
                {title && <h1>{title}</h1>}
                {children}
            </div>
        </div>
    );
};

export default SetupCard;
