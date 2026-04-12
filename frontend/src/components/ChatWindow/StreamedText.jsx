import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

export default function StreamedText({ text, speed = 10, speedVariance = 5, onComplete }) {
    const [displayedText, setDisplayedText] = useState('');

    useEffect(() => {
        setDisplayedText('');
        let i = 0;
        
        const typeNextChar = () => {
            if (i >= text.length) {
                if (onComplete) onComplete();
                return;
            }
            
            setDisplayedText(text.substring(0, i + 1));
            i++;
            
            // Randomize speed slightly to feel more like natural LLM streaming
            const nextSpeed = speed + (Math.random() * speedVariance);
            setTimeout(typeNextChar, nextSpeed);
        };
        
        const timeoutId = setTimeout(typeNextChar, speed);
        return () => clearTimeout(timeoutId);
    }, [text, speed, speedVariance]);

    return <ReactMarkdown>{displayedText}</ReactMarkdown>;
}
