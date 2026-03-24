export function playPremiumDing() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.8);

        const osc2 = ctx.createOscillator();
        const gainNode2 = ctx.createGain();
        osc2.connect(gainNode2);
        gainNode2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1108.73, ctx.currentTime);
        gainNode2.gain.setValueAtTime(0, ctx.currentTime);
        gainNode2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.03);
        gainNode2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 1.2);
    } catch (e) {
        console.warn("Audio playback failed", e);
    }
}
