import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function Tooltip({ children, text, position = 'bottom', delay = 300 }) {
    const [show, setShow] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const timeoutRef = useRef(null);
    const triggerRef = useRef(null);

    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const gap = 8;

        let top, left;
        switch (position) {
            case 'top':
                top = rect.top - gap;
                left = rect.left + rect.width / 2;
                break;
            case 'left':
                top = rect.top + rect.height / 2;
                left = rect.left - gap;
                break;
            case 'right':
                top = rect.top + rect.height / 2;
                left = rect.right + gap;
                break;
            default: // bottom
                top = rect.bottom + gap;
                left = rect.left + rect.width / 2;
        }

        setCoords({ top, left });
    }, [position]);

    const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
            updatePosition();
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

    const transformMap = {
        top: 'translate(-50%, -100%)',
        bottom: 'translate(-50%, 0)',
        left: 'translate(-100%, -50%)',
        right: 'translate(0, -50%)',
    };

    return (
        <div
            ref={triggerRef}
            className="relative inline-flex transition-all duration-300 transform-gpu"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={() => setShow(false)}
        >
            {children}
            {show && createPortal(
                <div
                    className="fixed z-[9999] pointer-events-none"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        transform: transformMap[position],
                        animation: 'tooltipFadeIn 0.25s ease-out'
                    }}
                >
                    <div className="bg-[#1a1625]/95 backdrop-blur-xl border border-accent/30 rounded-xl px-4 py-3 text-xs text-text-secondary max-w-[220px] whitespace-normal shadow-2xl shadow-black/50">
                        <div className="font-medium text-white/90 leading-relaxed">{text}</div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
