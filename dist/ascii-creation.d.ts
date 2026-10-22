export type AsciiDensity = 'medium' | 'high';

export class AsciiCreation extends HTMLElement {
  /** Resolves when the connected component has initialized. */
  readonly ready: Promise<this>;
  density: AsciiDensity;
  paused: boolean;
  play(): void;
  pause(): void;
  spark(): void;
  /** Returns the current printable ASCII grid. */
  toText(): string;
}

declare global {
  interface HTMLElementTagNameMap {
    'ascii-creation': AsciiCreation;
  }
}
