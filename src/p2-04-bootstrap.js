import { installPlayingControls } from './ui/playing-controls.js';

function install() {
  const game = window.hakodase;
  if (!game) return false;
  return installPlayingControls(game);
}

// Independent module graphs can finish in a different order. Try immediately,
// then retry after DOMContentLoaded and load. Duplicate installation is rejected
// by installPlayingControls itself.
if (!install()) {
  document.addEventListener('DOMContentLoaded', install, { once: true });
  window.addEventListener('load', install, { once: true });
}
