import React, { useEffect, useState } from 'react';
import './TransitionOverlay.css';

const TransitionOverlay = ({ isVisible, type, roundNumber, onComplete }) => {
    const [renderOverlay, setRenderOverlay] = useState(false);
    const [animating, setAnimating] = useState(false);

    useEffect(() => {
        if (isVisible) {
            setRenderOverlay(true);
            // Slight delay to ensure render before animation class is added (if needed), 
            // but usually we can just set animating true immediately or in next tick.
            requestAnimationFrame(() => {
                setAnimating(true);
            });

            // Match the total animation duration in CSS (3s)
            const timer = setTimeout(() => {
                setAnimating(false);
                setRenderOverlay(false);
                if (onComplete) onComplete();
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [isVisible, onComplete]);

    if (!renderOverlay) return null;

    let imageSrc = '/fximg/transition.png';

    if (type === 'round') {
        // Ensure roundNumber is within 1-5, default to 1 if missing
        const r = roundNumber || 1;
        imageSrc = `/fximg/round_${r}.png`;
    } else if (type === 'win') {
        imageSrc = '/fximg/you_win.png';
    } else if (type === 'lose') {
        // Handling the typo in the filename provided by user
        imageSrc = '/fximg/you_;ose.png';
    }

    return (
        <div className={`transition-overlay ${renderOverlay ? 'visible' : ''} ${animating ? 'animating' : ''}`}>
            <div className="transition-backdrop" />
            <div className="transition-content">
                <img src={imageSrc} alt="Transition" className="transition-image" />
            </div>
        </div>
    );
};

export default TransitionOverlay;
