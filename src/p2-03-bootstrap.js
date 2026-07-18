import { installCountdownFlow } from './ui/countdown-flow.js';

function install() {
  const game = window.hakodase;
  if (!game) return false;
  return installCountdownFlow(game);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
