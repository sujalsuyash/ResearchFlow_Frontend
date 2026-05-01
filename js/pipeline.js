document.addEventListener("DOMContentLoaded", () => {
  const observerOptions = {
    root: null,
    rootMargin: "0px",
    threshold: 0.2
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const delay = entry.target.getAttribute("data-delay") || "0";
        entry.target.style.transitionDelay = `${delay}ms`;
        entry.target.classList.add("visible");
      } else {
        entry.target.style.transitionDelay = "0ms"; // reset delay on exit
        entry.target.classList.remove("visible");
      }
    });
  }, observerOptions);

  const pipelineElements = document.querySelectorAll(".pipeline__stage, .pipeline__connector");
  pipelineElements.forEach(el => observer.observe(el));
});