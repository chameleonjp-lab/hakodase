import { installPlayFlow } from './ui/play-flow.js';

function install() {
  const game = window.hakodase;
  if (!game) return false;
  return installPlayFlow(game);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
