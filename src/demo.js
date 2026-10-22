import './ascii-creation.js';

const artwork = document.querySelector('ascii-creation');
const buttons = document.querySelectorAll('[data-density]');

for (const button of buttons) {
  button.addEventListener('click', () => {
    artwork.density = button.dataset.density;
    for (const item of buttons) {
      item.setAttribute('aria-pressed', String(item === button));
    }
  });
}
