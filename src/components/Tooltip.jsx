import { useState, useRef, useEffect } from 'react';

export default function Tooltip({ children, text, position = 'bottom', delay = 300 }) {
    const [show, setShow] = useState(false);
    const timeoutRef = useRef(null);
    const tooltipRef = useRef(null);

    const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
            setShow(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setShow(false);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    return (
        <div
            className="relative inline-flex"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            {show && (
                <div
                    ref={tooltipRef}
                    className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}
                    style={{ animation: 'tooltipFadeIn 0.25s ease-out' }}
                >
                    <div className="bg-bg-secondary/95 backdrop-blur-xl border border-accent/30 rounded-xl px-4 py-3 text-xs text-text-secondary max-w-[220px] whitespace-normal shadow-xl shadow-black/30">
                        <div className="font-medium text-white/90 leading-relaxed">{text}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
