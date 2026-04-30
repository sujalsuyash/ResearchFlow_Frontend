/* =========================================
   cookie.js
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
    const cookieWidget = document.getElementById("cookie-widget");
    const cookieArea = document.getElementById("cookie-area");
    const fortuneText = document.getElementById("fortune-text");

    if (!cookieWidget || !cookieArea || !fortuneText) return;

    // The upgraded, highly cynical researcher fortunes
    const fortunes = [
        "Reviewer 2 hates you. It's nothing personal.",
        "Your code won't compile on their first run anyway.",
        "That 'quick' lit review will take three weeks.",
        "Just write 'further research is needed' and go to sleep.",
        "Your imposter syndrome is actually completely justified today.",
        "The paper you need is cited everywhere but completely inaccessible.",
        "Plot twist: Your baseline model was actually better.",
        "You will spend 4 hours formatting citations.",
        "Claude code will actually eat your job.",
        "Zhang et. al. already published that idea 10 years ago.",
        "May your ML models never overfit",
        "Touch some grass brother",
        "Yes, someone else already published this in 2018.",
        "May your coffee be stronger than your peer reviews."
    ];

    let isCracked = false;

    cookieArea.addEventListener("click", () => {
        if (!isCracked) {
            const randomIndex = Math.floor(Math.random() * fortunes.length);
            fortuneText.innerText = fortunes[randomIndex];
            
            cookieWidget.classList.add("cracked");
            isCracked = true;
        } else {
            cookieWidget.classList.remove("cracked");
            isCracked = false;
            
            setTimeout(() => {
                if (!isCracked) fortuneText.innerText = "";
            }, 350); 
        }
    });
});