import React, { useEffect, useState } from 'react';
import './OverlayAnimation.css';

const OverlayAnimation = ({ isVisible, imageSrc, onMidPoint, onComplete }) => {
    const [stage, setStage] = useState('idle'); // idle, entering, active, exiting

    useEffect(() => {
        if (isVisible) {
            setStage('entering');

            // Timing configuration
            const ENTER_DURATION = 500;
            const STAY_DURATION = 1500; // Time to stay visible
            const EXIT_DURATION = 500;

            // 1. Enter Animation finishes
            const enterTimer = setTimeout(() => {
                setStage('active');

                // Execute mid-point action (e.g., view change) if provided
                if (onMidPoint) {
                    onMidPoint();
                }
            }, ENTER_DURATION);

            // 2. Start Exit Animation
            // If onMidPoint is provided, we might want a shorter stay or immediate exit?
            // Usually transitions are quick: Cover -> Swap -> Reveal.
            // Notifications are slow: Show -> Wait -> Hide.
            const timeToWait = onMidPoint ? 500 : STAY_DURATION;

            const exitTimer = setTimeout(() => {
                setStage('exiting');
            }, ENTER_DURATION + timeToWait);

            // 3. Complete
            const completeTimer = setTimeout(() => {
                setStage('idle');
                if (onComplete) onComplete();
            }, ENTER_DURATION + timeToWait + EXIT_DURATION);

            return () => {
                clearTimeout(enterTimer);
                clearTimeout(exitTimer);
                clearTimeout(completeTimer);
            };
        }
    }, [isVisible, onMidPoint, onComplete]);

    if (!isVisible && stage === 'idle') return null;

    return (
        <div className={`overlay-animation ${stage}`}>
            <div className="overlay-content">
                {imageSrc && <img src={imageSrc} alt="Overlay" className="overlay-image" />}
            </div>
            <div className="overlay-scanlines"></div>
        </div>
    );
};

export default OverlayAnimation;
