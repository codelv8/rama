/** Quiet procedural UI chimes. No audio runs before the player's gesture. */
export function createAudio() {
  let context;
  let enabled = false;
  function play(kind = 'click') {
    if (!enabled) return;
    try {
      context ||= new (window.AudioContext || window.webkitAudioContext)();
      if (context.state === 'suspended') context.resume();
      const tones = kind === 'success' ? [523.25, 659.25, 783.99] : kind === 'error' ? [220, 196] : [440];
      tones.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const at = context.currentTime + index * 0.09;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.045, at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.36);
      });
    } catch { /* A silent device does not block the game. */ }
  }
  return { play, setEnabled(value, chime = true) { enabled = !!value; if (enabled && chime) play(); }, get enabled() { return enabled; } };
}
