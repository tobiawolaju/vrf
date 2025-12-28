import React from 'react';
import './Avatar.css';

const Avatar = ({ src, name, size = 'small', className = '' }) => {
    const isImage = src && src.startsWith('http');

    return (
        <div className={`avatar-container ${size} ${className}`}>
            {isImage ? (
                <img src={src} alt={name} className="avatar-img" />
            ) : (
                <span className="avatar-placeholder">{src || '👤'}</span>
            )}
        </div>
    );
};

export default Avatar;
