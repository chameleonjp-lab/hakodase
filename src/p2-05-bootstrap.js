import { installResultFlow } from './ui/result-flow.js';

function install() {
  const game = window.hakodase;
  if (!game) return false;
  return installResultFlow(game);
}

// Module scripts may execute at `interactive` before main.js creates the Game.
// Retry at DOMContentLoaded only when the immediate installation cannot run.
if (!install()) {
  document.addEventListener('DOMContentLoaded', install, { once: true });
}
