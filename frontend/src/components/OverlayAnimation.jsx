import React, { useEffect, useState } from 'react';
import './OverlayAnimation.css';

const OverlayAnimation = ({ isVisible, imageSrc, onMidPoint, onComplete }) => {
    const [animationState, setAnimationState] = useState('idle'); // idle, slide-in, hold, slide-out

    useEffect(() => {
        if (isVisible) {
            setAnimationState('slide-in');

            // Timing configuration
            const slideDuration = 800; // Match CSS animation
            const holdDuration = 1000; // How long to stay in center

            // 1. Slide In
            const holdTimer = setTimeout(() => {
                setAnimationState('hold');
                if (onMidPoint) onMidPoint();

                // 2. Hold then Slide Out
                const outTimer = setTimeout(() => {
                    setAnimationState('slide-out');

                    // 3. Complete
                    const completeTimer = setTimeout(() => {
                        setAnimationState('idle');
                        if (onComplete) onComplete();
                    }, slideDuration);

                    return () => clearTimeout(completeTimer);
                }, holdDuration);

                return () => clearTimeout(outTimer);
            }, slideDuration);

            return () => clearTimeout(holdTimer);
        }
    }, [isVisible, onMidPoint, onComplete]);

    if (!isVisible && animationState === 'idle') return null;

    return (
        <div className={`overlay-container ${animationState !== 'idle' ? 'active' : ''} ${animationState}`}>
            <div className="overlay-backdrop"></div>
            {imageSrc && (
                <img src={imageSrc} alt="Overlay" className="overlay-image" />
            )}
        </div>
    );
};

export default OverlayAnimation;
