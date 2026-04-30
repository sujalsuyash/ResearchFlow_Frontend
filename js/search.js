/* =========================================
   search.js — Research API Integration
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
    // ── DOM Elements (Matching your exact HTML IDs) ──
    const ctaBtn = document.getElementById("cta-btn");
    const searchBox = document.getElementById("search-box");
    const searchInput = document.getElementById("search-input");
    const searchSubmit = document.getElementById("search-submit");
    
    const loadingState = document.getElementById("hero-loading");
    const resultsState = document.getElementById("hero-results");
    const resultsContent = document.getElementById("results-content");
    const errorState = document.getElementById("hero-error");
    
    const newSearchBtn = document.getElementById("new-search-btn");
    const errorRetryBtn = document.getElementById("error-retry-btn");
    
    const searchArea = document.getElementById("hero-search");

    // API Configuration
    const API_BASE = "https://researchflow-production.up.railway.app";
    const TIMEOUT_MS = 90000; // 90 seconds timeout

    // ── 1. UI Interactions (The Morph) ──
    if (ctaBtn && searchBox) {
        ctaBtn.addEventListener("click", () => {
            // Apply the classes defined in your hero.css
            ctaBtn.classList.add("hidden");
            searchBox.classList.add("visible");
            searchInput.focus();
        });
    }

    // ── 2. API Fetch with Custom Timeout ──
    async function fetchWithTimeout(resource, options = {}) {
        const { timeout = TIMEOUT_MS } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(resource, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    }

    // ── 3. Handle the Search Execution ──
    async function executeSearch() {
        const query = searchInput.value.trim();
        if (!query) return;

        // Hide search box and show loading dots
        searchBox.classList.remove("visible");
        resultsState.classList.remove("active");
        errorState.classList.remove("active");
        loadingState.classList.add("active");

        window.scrollTo({
            top: searchArea.offsetTop - 50,
            behavior: "smooth"
        });

        try {
            // STEP 1: Start the Job
            console.log("Starting research job...");
            const initialResponse = await fetch(`${API_BASE}/research`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: query })
            });

            if (!initialResponse.ok) throw new Error(`API Error: ${initialResponse.status}`);
            
            const initialData = await initialResponse.json();
            console.log("Initial Response:", initialData);

            // Extract the job ID. (Adjusting for common backend naming conventions)
            const jobId = initialData.job_id || initialData.task_id || initialData.id;

            let finalData = initialData;

            // STEP 2: Poll for Results (If a job ID was returned)
            if (jobId) {
                console.log(`Job queued with ID: ${jobId}. Starting polling...`);
                let isComplete = false;
                let attempts = 0;
                const maxAttempts = 40; // Max 40 attempts * 3 seconds = 2 minutes timeout

                while (!isComplete && attempts < maxAttempts) {
                    attempts++;
                    // Wait 3 seconds before checking
                    await new Promise(resolve => setTimeout(resolve, 3000)); 
                    
                    console.log(`Polling attempt ${attempts}...`);
                    const pollResponse = await fetch(`${API_BASE}/research/${jobId}`);
                    
                    if (!pollResponse.ok) throw new Error(`Polling Error: ${pollResponse.status}`);
                    
                    const pollData = await pollResponse.json();
                    console.log("Poll Response:", pollData);

                    // Check if the backend says it's done. 
                    // (Assuming your backend sends a status like 'completed' or just sends the report when ready)
                    const status = pollData.status ? pollData.status.toLowerCase() : "unknown";
                    
                    if (status === "completed" || status === "success" || pollData.report || pollData.result) {
                        isComplete = true;
                        finalData = pollData;
                    } else if (status === "failed" || status === "error") {
                        throw new Error("Backend reported that the research job failed.");
                    }
                    // If status is "pending" or "processing", the loop will just run again.
                }
                
                if (!isComplete) {
                    throw new Error("Polling timed out. The research took too long.");
                }
            }

            // STEP 3: Extract and Render the Markdown
            let markdownContent = "No content returned.";
            
            if (finalData.report) { markdownContent = finalData.report; }
            else if (finalData.result)   { markdownContent = finalData.result; }
            else if (finalData.text)     { markdownContent = finalData.text; }
            else if (finalData.output)   { markdownContent = finalData.output; }
            else {
                // Absolute fallback just in case
                const firstStringKey = Object.keys(finalData).find(key => typeof finalData[key] === "string" && finalData[key].length > 50);
                if (firstStringKey) markdownContent = finalData[firstStringKey];
            }

            // Convert Markdown to HTML and inject it
            resultsContent.innerHTML = marked.parse(markdownContent);

            const links = resultsContent.querySelectorAll("a");
            links.forEach(link => {
                link.setAttribute("target", "_blank");
                link.setAttribute("rel", "noopener noreferrer");
            });

            // Hide loading, show results
            loadingState.classList.remove("active");
            resultsState.classList.add("active");

        } catch (error) {
            console.error("ResearchFlow Error:", error);
            // Hide loading, show error state
            loadingState.classList.remove("active");
            errorState.classList.add("active");
        }
    }

    // ── 4. Event Listeners for Searching ──
    
    // Click the search button
    if (searchSubmit) {
        searchSubmit.addEventListener("click", executeSearch);
    }

    // Hit "Enter" inside the input field
    if (searchInput) {
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                executeSearch();
            }
        });
    }

    // Reset UI for a new search
    if (newSearchBtn) {
        newSearchBtn.addEventListener("click", () => {
            resultsState.classList.remove("active");
            searchInput.value = "";
            searchBox.classList.add("visible");
            searchInput.focus();
        });
    }

    // Retry button on error state
    if (errorRetryBtn) {
        errorRetryBtn.addEventListener("click", executeSearch);
    }
});