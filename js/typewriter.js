/* ═══════════════════════════════════════════
   typewriter.js
═══════════════════════════════════════════ */

(function () {
  const el = document.getElementById('typewriter');
  if (!el) return;

  const phrases = [
    "Spent 6 hours reading papers?",
    "Lost in a sea of citations?",
    "Let Episteme do it in minutes.",
    "Because reading 40 papers is a bad use of your afternoon.",
    "Query → Plan → Search → Synthesize → Report."
  ];

  // Respect reduced-motion: just show the last phrase statically
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = phrases[phrases.length - 1];
    return;
  }

  let phraseIndex = 0;
  let charIndex   = 0;
  let isDeleting  = false;

  const TYPE_SPEED   = 48;   // ms per character when typing
  const DELETE_SPEED = 24;   // ms per character when deleting
  const PAUSE_END    = 1800; // ms to wait at end of phrase
  const PAUSE_START  = 350;  // ms to wait before starting next phrase

  function tick() {
    const current = phrases[phraseIndex];

    if (!isDeleting) {
      // Type next character
      charIndex++;
      el.textContent = current.slice(0, charIndex);

      if (charIndex === current.length) {
        // Finished typing — pause then start deleting
        isDeleting = true;
        setTimeout(tick, PAUSE_END);
        return;
      }
      setTimeout(tick, TYPE_SPEED);
    } else {
      // Delete one character
      charIndex--;
      el.textContent = current.slice(0, charIndex);

      if (charIndex === 0) {
        // Finished deleting — move to next phrase
        isDeleting  = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        setTimeout(tick, PAUSE_START);
        return;
      }
      setTimeout(tick, DELETE_SPEED);
    }
  }

  // Small initial delay so page renders first
  setTimeout(tick, 800);
})();