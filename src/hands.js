import { HAND_TONES } from './hand-tones.js';

export const WIDTH = 1200;
export const HEIGHT = 510;
export const HAND_ANCHORS = HAND_TONES.anchors;

// Decode the original, detailed luminance source into two independent layers.
// These canvases are sampled by the ASCII renderer. They are never displayed.
let layersPromise;

export function makeHands() {
  layersPromise ??= decodeHands().catch(error => {
    layersPromise = undefined;
    throw error;
  });
  return layersPromise;
}

async function decodeHands() {
  const bytes = Uint8Array.from(atob(HAND_TONES.data), character => character.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const tones = new Uint8Array(await new Response(stream).arrayBuffer());
  if (tones.length !== HAND_TONES.width * HAND_TONES.height) throw new Error('The hand luminance map is incomplete.');
  const texture = document.createElement('canvas');
  texture.width = HAND_TONES.width; texture.height = HAND_TONES.height;
  const textureContext = texture.getContext('2d');
  const pixels = textureContext.createImageData(texture.width, texture.height);
  for (let i = 0; i < tones.length; i++) {
    const value = Math.round(tones[i] / (HAND_TONES.levels - 1) * 255);
    pixels.data[i * 4] = value;
    pixels.data[i * 4 + 1] = value;
    pixels.data[i * 4 + 2] = value;
    pixels.data[i * 4 + 3] = tones[i] ? 255 : 0;
  }
  textureContext.putImageData(pixels, 0, 0);
  const layers = {};
  for (const [name, side] of [['robot', 0], ['human', 1]]) {
    const layer = document.createElement('canvas');
    layer.width = WIDTH; layer.height = HEIGHT;
    const context = layer.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    const sourceX = side ? HAND_TONES.split : 0;
    const sourceWidth = side ? texture.width - HAND_TONES.split : HAND_TONES.split;
    // Preserve the source pose and spacing. Split at the actual empty gap.
    context.drawImage(texture, sourceX, 0, sourceWidth, texture.height, sourceX / texture.width * WIDTH, 0, sourceWidth / texture.width * WIDTH, HEIGHT);
    layers[name] = layer;
  }
  return layers;
}
