/* ═══════════════════════════════════════════════════════════════════════
   WizzCall — Utility Functions
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Format seconds into MM:SS string
 */
function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

/**
 * Simple sound effects using Web Audio API oscillator
 */
const SFX = {
  _ctx: null,

  _getContext() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this._ctx;
  },

  /**
   * Play a short beep tone
   * @param {number} freq - Frequency in Hz
   * @param {number} duration - Duration in seconds
   * @param {string} type - Oscillator type
   * @param {number} volume - Gain (0-1)
   */
  _play(freq, duration, type = 'sine', volume = 0.15) {
    try {
      const ctx = this._getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Silently fail if audio context isn't available
    }
  },

  /** Played when a match is found */
  matched() {
    this._play(660, 0.15, 'sine', 0.12);
    setTimeout(() => this._play(880, 0.2, 'sine', 0.12), 150);
  },

  /** Played when partner disconnects */
  disconnected() {
    this._play(440, 0.2, 'sine', 0.1);
    setTimeout(() => this._play(330, 0.3, 'sine', 0.1), 200);
  },

  /** Played when user clicks a button */
  click() {
    this._play(500, 0.06, 'sine', 0.06);
  },

  /** Played when entering search queue */
  searching() {
    this._play(550, 0.1, 'triangle', 0.08);
  }
};

/**
 * Creates visualizer bars in the given container
 * @param {HTMLElement} container
 * @param {number} count - Number of bars
 */
function createVisualizerBars(container, count = 32) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const bar = document.createElement('div');
    bar.classList.add('viz-bar', 'idle');
    // Stagger the idle animation
    bar.style.animationDelay = `${(i * 0.05) % 1}s`;
    container.appendChild(bar);
  }
}

/**
 * Update visualizer bars with frequency data
 * @param {HTMLElement} container
 * @param {Uint8Array} frequencyData
 */
function updateVisualizerBars(container, frequencyData) {
  const bars = container.querySelectorAll('.viz-bar');
  const barCount = bars.length;
  const dataLength = frequencyData.length;

  for (let i = 0; i < barCount; i++) {
    // Map bar index to frequency data index
    const dataIndex = Math.floor((i / barCount) * dataLength);
    const value = frequencyData[dataIndex] || 0;
    // Scale to a visible height (4px min, 120px max)
    const height = Math.max(4, (value / 255) * 120);

    bars[i].style.height = `${height}px`;
    bars[i].classList.remove('idle');

    // Color intensity based on value
    const intensity = value / 255;
    bars[i].style.opacity = 0.4 + intensity * 0.6;
  }
}

/**
 * Reset visualizer bars to idle state
 * @param {HTMLElement} container
 */
function resetVisualizerBars(container) {
  const bars = container.querySelectorAll('.viz-bar');
  bars.forEach((bar, i) => {
    bar.style.height = '';
    bar.style.opacity = '';
    bar.classList.add('idle');
    bar.style.animationDelay = `${(i * 0.05) % 1}s`;
  });
}
