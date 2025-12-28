import React from 'react';
import './Dice3D.css';

const Dice3D = ({ roll, isRolling, onDragOver, onDrop }) => {
    return (
        <div className="die-area" onDragOver={onDragOver} onDrop={onDrop}>
            <div className="die-display">
                <div className={`die-cube ${isRolling ? 'rolling' : ''}`} data-roll={roll}>
                    <div className="face front">1</div>
                    <div className="face back">6</div>
                    <div className="face right">3</div>
                    <div className="face left">4</div>
                    <div className="face top">5</div>
                    <div className="face bottom">2</div>
                </div>
            </div>
        </div>
    );
};

export default Dice3D;
