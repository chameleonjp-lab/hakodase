import { installPlayingControls } from './ui/playing-controls.js';

function install() {
  const game = window.hakodase;
  if (!game) return false;
  return installPlayingControls(game);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
