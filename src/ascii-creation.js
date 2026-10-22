import { makeHands } from './hands.js';
import { AsciiRenderer, DENSITIES } from './renderer.js';

const HTMLElementBase = globalThis.HTMLElement ?? class {};

export class AsciiCreation extends HTMLElementBase {
  static observedAttributes = ['density', 'paused'];

  #renderer;
  #generation = 0;
  #canvas;
  #fallback;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; width: 100%; aspect-ratio: 1200 / 510; background: #0b0c0c; overflow: hidden; }
        canvas { display: block; width: 100%; height: 100%; cursor: pointer; touch-action: pan-y; }
        canvas:focus-visible { outline: 1px solid #d5e8b4; outline-offset: -2px; }
        p { margin: 0; padding: 24px; color: #e8e9e4; font: 13px monospace; }
        [hidden] { display: none; }
      </style>
      <canvas role="button" tabindex="0" aria-label="Send a spark between the human and robotic ASCII hands"></canvas>
      <p hidden role="alert">The ASCII artwork could not be loaded.</p>
    `;
    this.#canvas = root.querySelector('canvas');
    this.#fallback = root.querySelector('p');
    this.#canvas.addEventListener('click', () => this.spark());
    this.#canvas.addEventListener('keydown', event => {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        this.spark();
      }
    });
    this.ready = Promise.resolve(this);
  }

  connectedCallback() {
    const generation = ++this.#generation;
    this.ready = makeHands().then(layers => {
      if (!this.isConnected || generation !== this.#generation) return this;
      this.#fallback.hidden = true;
      this.#canvas.hidden = false;
      this.#renderer = new AsciiRenderer(this.#canvas, layers, {
        density: this.density,
        paused: this.paused,
      });
      this.dispatchEvent(new CustomEvent('ready'));
      return this;
    }).catch(error => {
      if (this.isConnected && generation === this.#generation) {
        this.#canvas.hidden = true;
        this.#fallback.hidden = false;
        this.dispatchEvent(new CustomEvent('error', { detail: error }));
      }
      throw error;
    });
    // A consumer can await `ready`; the component also has a visible error state.
    this.ready.catch(() => {});
  }

  disconnectedCallback() {
    this.#generation++;
    this.#renderer?.destroy();
    this.#renderer = undefined;
  }

  attributeChangedCallback(name) {
    if (name === 'density') this.#renderer?.setDensity(this.density);
    if (name === 'paused') this.#renderer?.setPaused(this.paused);
  }

  get density() {
    const value = this.getAttribute('density');
    return Object.hasOwn(DENSITIES, value) ? value : 'medium';
  }

  set density(value) {
    if (!Object.hasOwn(DENSITIES, value)) {
      throw new RangeError('Density must be "medium" or "high".');
    }
    this.setAttribute('density', value);
  }

  get paused() { return this.hasAttribute('paused'); }
  set paused(value) { this.toggleAttribute('paused', Boolean(value)); }

  play() { this.paused = false; }
  pause() { this.paused = true; }

  spark() {
    this.play();
    this.#renderer?.spark();
  }

  toText() { return this.#renderer?.toText() ?? ''; }
}

if (globalThis.customElements && !customElements.get('ascii-creation')) {
  customElements.define('ascii-creation', AsciiCreation);
}
