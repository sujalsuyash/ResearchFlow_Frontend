/* =========================================
   scroll.js
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
    const observerOptions = {
        root: null,
        rootMargin: "0px",
        threshold: 0.15 
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // CHANGED: Now adds "visible" to match your main.css
                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll(".reveal");
    
    // Fallback: If no elements are found, log to console to help debug
    if (revealElements.length === 0) {
        console.warn("Scroll.js: No elements with the '.reveal' class were found on this page.");
    }

    revealElements.forEach(el => observer.observe(el));
});