// components/JD/JDOverviewCards.jsx
// Shown inline in chat when agent has gathered enough info
import { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';

const VARIANT_ICONS = {
    'Skill-Focused': '⚡',
    'Outcome-Focused': '🎯',
    'Hybrid': '✨',
};

export default function JDOverviewCards({ overviews }) {
    const { generateJD, isTyping, fullJD, selectedOverview } = useChat();
    const textRefs = useRef([]);

    // Initialize selected index by matching with persistent selectedOverview if available
    const initialIndex = selectedOverview
        ? overviews.findIndex(o => o.description === selectedOverview)
        : 0;

    const [selectedIndex, setSelectedIndex] = useState(initialIndex === -1 ? 0 : initialIndex);
    const [editedTexts, setEditedTexts] = useState(
        overviews.map(o => o.description)
    );
    const [generating, setGenerating] = useState(false);

    const handleGenerate = async () => {
        setGenerating(true);
        await generateJD(editedTexts[selectedIndex]);
        setGenerating(false);
    };

    // Calculate max height based on content
    useEffect(() => {
        if (!textRefs.current.length) return;

        // Reset heights to auto to get true scrollHeight
        textRefs.current.forEach(el => {
            if (el) el.style.height = 'auto';
        });

        // Find max
        const maxHeight = Math.max(
            ...textRefs.current.map(el => (el ? el.scrollHeight : 0)),
            200 // explicit matching of css min-height
        );

        // Apply max
        textRefs.current.forEach(el => {
            if (el) el.style.height = maxHeight + 'px';
        });
    }, [editedTexts, fullJD]);

    // Remove the early return so variants stay visible

    return (
        <div className="jd-cards-container">
            <div className="jd-cards-header">Choose a JD Overview</div>

            <div className="jd-cards-grid">
                {overviews.map((overview, idx) => (
                    <div
                        key={idx}
                        className={`jd-card ${selectedIndex === idx ? 'selected' : ''} ${fullJD ? 'read-only' : ''}`}
                        onClick={() => !fullJD && setSelectedIndex(idx)}
                        style={{ animation: 'chipStreamIn 0.4s ease backwards', animationDelay: `${idx * 0.15}s` }}
                    >
                        <div className="jd-card-variant">
                            <span>{VARIANT_ICONS[overview.variant] || '📄'}</span>
                            {overview.variant}
                            <div className="jd-card-select-dot" />
                        </div>
                        <textarea
                            ref={el => textRefs.current[idx] = el}
                            className="jd-card-text"
                            value={editedTexts[idx]}
                            rows={1}
                            onChange={(e) => {
                                if (fullJD) return;
                                const updated = [...editedTexts];
                                updated[idx] = e.target.value;
                                setEditedTexts(updated);
                            }}
                            readOnly={!!fullJD}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!fullJD) setSelectedIndex(idx);
                            }}
                            placeholder="Overview text..."
                        />
                    </div>
                ))}
            </div>

            {!fullJD && (
                <button
                    className="generate-jd-btn"
                    onClick={handleGenerate}
                    disabled={generating || isTyping}
                >
                    {generating ? '⏳ Generating…' : '✦ Generate Job Description'}
                </button>
            )}
        </div>
    );
}
