import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../../context/ChatContext';
import FinalJDCard from './cards/FinalJDCard';
import { IconFileText, IconSparkles } from './icons';

/**
 * JDCanvas — the right side of the split. Three states:
 *   1. EMPTY (intake / internal_check / market_research): quiet placeholder.
 *   2. PREVIEW (jd_variants): hover-preview of focused variant, or "Pick a style".
 *   3. DOCUMENT (final_jd onward): the JD itself, with actions + bias diff.
 */
const JDCanvas = ({ previewVariantType }) => {
    const {
        workflowStage,
        finalJdMarkdown,
        streamingJdText,
        isJdStreaming,
        variantsCard,
    } = useChat();

    // Document state: streaming or final JD present
    const hasJd = Boolean(finalJdMarkdown) || Boolean(streamingJdText);

    if (hasJd) {
        return <FinalJDCard />;
    }

    // Variants preview state
    if (workflowStage === 'jd_variants' && variantsCard?.variants?.length) {
        const focused = previewVariantType
            ? variantsCard.variants.find((v) => v.type === previewVariantType)
            : null;
        return (
            <CanvasShell stageLabel="Drafting · Choose a style">
                {focused ? (
                    <div className="canvas-doc">
                        <div className="canvas-preview-eyebrow">
                            <IconSparkles size={12} />
                            Preview · {LABELS[focused.type] || focused.type}
                        </div>
                        <div className="jd-doc">
                            <ReactMarkdown>{stripBoilerplate(focused.content)}</ReactMarkdown>
                        </div>
                    </div>
                ) : (
                    <CanvasPlaceholder
                        eyebrow="Step 4 · Choose a style"
                        title="Hover a style on the left to preview it here."
                        footer="Each variant is a complete draft. Select one to generate the final JD."
                    />
                )}
            </CanvasShell>
        );
    }

    // Empty / quiet placeholder for intake → market_research
    return (
        <CanvasShell stageLabel="Document · Draft">
            <CanvasPlaceholder
                eyebrow="Drafting space"
                title="Your job description will appear here as we build it together."
                footer="We'll shape the role through chat first — skills, scope, market context — then write the JD here on the right."
            />
        </CanvasShell>
    );
};

const CanvasShell = ({ stageLabel, children }) => (
    <>
        <div className="canvas-head">
            <div className="canvas-head-meta">
                <IconFileText size={14} />
                <span>{stageLabel}</span>
            </div>
        </div>
        <div className="canvas-body">{children}</div>
    </>
);

const CanvasPlaceholder = ({ eyebrow, title, footer }) => (
    <div className="canvas-placeholder">
        <div className="canvas-placeholder-eyebrow">
            <IconFileText size={12} />
            {eyebrow}
        </div>
        <h2 className="canvas-placeholder-title">{title}</h2>
        <div className="canvas-placeholder-lines" aria-hidden="true">
            <div className="canvas-placeholder-line" />
            <div className="canvas-placeholder-line" />
            <div className="canvas-placeholder-line" />
            <div className="canvas-placeholder-line is-gap" />
            <div className="canvas-placeholder-line" />
            <div className="canvas-placeholder-line" />
        </div>
        {footer && <div className="canvas-placeholder-footer">{footer}</div>}
    </div>
);

const LABELS = {
    skill_focused: 'Skill-Focused',
    outcome_focused: 'Outcome-Focused',
    hybrid: 'Hybrid',
};

function stripBoilerplate(content) {
    if (!content) return '';
    let cleaned = content.replace(/^#\s+.+\n*/m, '');
    cleaned = cleaned.replace(
        /##\s*About\s+(Our\s+)?(Organization|Team|Company)[\s\S]*?(?=\n##\s|\n#\s|$)/gi,
        ''
    );
    return cleaned.trim();
}

export default JDCanvas;
