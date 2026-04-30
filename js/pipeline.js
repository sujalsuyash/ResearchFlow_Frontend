document.addEventListener("DOMContentLoaded", () => {
    const observerOptions = {
        root: null,
        rootMargin: "0px",
        threshold: 0.2
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Get the delay from the HTML data attribute
                const delay = entry.target.getAttribute('data-delay') || '0';
                
                // Apply it as an inline CSS transition delay
                entry.target.style.transitionDelay = `${delay}ms`;
                
                // Add the visible class to trigger the CSS animation
                entry.target.classList.add("visible");
                
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe both the stages and the connectors
    const pipelineElements = document.querySelectorAll(".pipeline__stage, .pipeline__connector");
    pipelineElements.forEach(el => observer.observe(el));
});