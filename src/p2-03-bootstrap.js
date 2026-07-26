import { installCountdownFlow } from './ui/countdown-flow.js';

function install() {
  const game = window.hakodase;
  if (!game) return false;
  return installCountdownFlow(game);
}

// Independent module graphs can finish in a different order. Try immediately,
// then retry after DOMContentLoaded and load so Game creation order cannot skip
// the Phase integration. The flow itself rejects duplicate installation.
if (!install()) {
  document.addEventListener('DOMContentLoaded', install, { once: true });
  window.addEventListener('load', install, { once: true });
}
