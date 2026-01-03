import React from 'react';
import './Dice3D.css';

const Dice3D = ({ roll, isRolling, onDragOver, onDrop }) => {
    return (
        <div className="die-area" onDragOver={onDragOver} onDrop={onDrop}>
            <div className="die-display">
                <div className={`die-cube ${isRolling ? 'rolling' : ''}`} data-roll={roll}>
                    <div className="face front">⚀</div>
                    <div className="face back">⚅</div>
                    <div className="face right">⚂</div>
                    <div className="face left">⚃</div>
                    <div className="face top">⚄</div>
                    <div className="face bottom">⚁</div>
                </div>
            </div>
        </div>
    );
};

export default Dice3D;
