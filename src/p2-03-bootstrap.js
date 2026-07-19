import { installCountdownFlow } from './ui/countdown-flow.js';

function install() {
  const game = window.hakodase;
  if (!game) return false;
  return installCountdownFlow(game);
}

// Module scripts can run while the document is already `interactive` but before
// main.js's DOMContentLoaded listener creates the Game instance. Try now, then
// retry once at DOMContentLoaded when the shared game is not ready yet.
if (!install()) {
  document.addEventListener('DOMContentLoaded', install, { once: true });
}
