import React from 'react';
import './Deck.css';

const rarities = [
    { id: 'common', label: 'Common', count: 9999, class: 'stack-common', textClass: '' },
    { id: 'mst', label: 'MST', count: 9999, class: 'stack-mst', textClass: 'mst-text' },
    { id: 'uncommon', label: 'Uncommon', count: 9999, class: 'stack-uncommon', textClass: 'uncommon-text' },
    { id: 'rare', label: 'Rare', count: 9999, class: 'stack-rare', textClass: 'rare-text' },
    { id: 'ultra-rare', label: 'Ultra Rare', count: 9999, class: 'stack-ultra-rare', textClass: 'ultra-rare-text' },
    { id: 'gold', label: 'Gold', count: 9999, class: 'stack-gold', textClass: 'gold-text' },
];

const Deck = ({ setView }) => {
    // Generate 10 cards for the stack effect
    const stackLevels = Array.from({ length: 10 }, (_, i) => i);

    return (
        <div className="home-container">
            <div className="deck-card">
                <button className="btn-back-home" onClick={() => setView('home')}>
                    ← BACK
                </button>

                <h1 className="deck-title">Card Collection</h1>

                <div className="stacks-grid">
                    {rarities.map((rarity) => (
                        <div key={rarity.id} className={`card-stack-container ${rarity.class}`}>
                            <div className="stack-visual">
                                {stackLevels.map((lvl) => {
                                    // Calculate offset for stack effect
                                    const xOffset = lvl * -1.5;
                                    const yOffset = lvl * -1.5;
                                    const hoverX = (lvl - 5) * 5;
                                    const hoverY = (lvl - 5) * -10;
                                    const hoverRotate = (lvl - 5) * 2;

                                    return (
                                        <div
                                            key={lvl}
                                            className="stacked-card"
                                            style={{
                                                bottom: `${lvl * 2}px`,
                                                left: `${lvl * 2}px`,
                                                zIndex: lvl,
                                                '--hover-x': `${hoverX}px`,
                                                '--hover-y': `${hoverY}px`,
                                                '--hover-rotate': `${hoverRotate}deg`
                                            }}
                                        >
                                            <img src={`/card${(lvl % 3) + 1}.png`} alt="Card" />
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="stack-info">
                                <span className={`rarity-label ${rarity.textClass}`}>{rarity.label}</span>
                                <span className="card-count">{rarity.count.toLocaleString()} CARDS</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Deck;
