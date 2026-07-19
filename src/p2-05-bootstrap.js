import { installResultFlow } from './ui/result-flow.js';

function install() {
  const game = window.hakodase;
  if (!game) return false;
  return installResultFlow(game);
}

// Independent module graphs can finish in a different order. Try immediately,
// then retry after DOMContentLoaded and load. Duplicate installation is rejected
// by installResultFlow itself.
if (!install()) {
  document.addEventListener('DOMContentLoaded', install, { once: true });
  window.addEventListener('load', install, { once: true });
}
