
import React, { useEffect, useRef } from 'react';
import BalatroShader from '../lib/balatroShader';

const BalatroBackground = ({
    colors = { c1: "#00ff40ff", c2: "#cfedffff", c3: "#ffffffff" },
    speed = 1.0,
    contrast = 2.0,
    spinAmount = 0.5,
    pixelSizeFac = 1000,
    spinEase = 0.5,
    zoom = 30,
    opacity = 1.0
}) => {
    const containerRef = useRef(null);
    const shaderInstance = useRef(null);

    useEffect(() => {
        if (containerRef.current && !shaderInstance.current) {
            try {
                shaderInstance.current = new BalatroShader({
                    container: containerRef.current,
                    colours: colors,
                    speed,
                    contrast,
                    spinAmount,
                    pixelSizeFac,
                    spinEase,
                    zoom,
                    opacity
                });
            } catch (err) {
                console.error("Failed to initialize BalatroShader:", err);
            }
        }

        return () => {
            if (shaderInstance.current) {
                shaderInstance.current.destroy();
                shaderInstance.current = null;
            }
        };
    }, []);

    // Handle updates if needed (could re-apply uniforms instead of destroying/re-creating)
    useEffect(() => {
        if (shaderInstance.current) {
            // Currently the library doesn't support updating options on the fly
            // without re-creating. For a background, static-ish setup is usually fine.
            // But we can add update logic if needed.
        }
    }, [colors, speed, contrast, spinAmount, pixelSizeFac, spinEase, zoom, opacity]);

    return (
        <div
            ref={containerRef}
            className="balatro-background-container"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: -1,
                overflow: 'hidden',
                pointerEvents: 'none'
            }}
        />
    );
};

export default BalatroBackground;
