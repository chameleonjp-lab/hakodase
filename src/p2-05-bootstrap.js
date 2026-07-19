import { installResultFlow } from './ui/result-flow.js';

function install() {
  const game = window.hakodase;
  if (!game) return false;
  return installResultFlow(game);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
