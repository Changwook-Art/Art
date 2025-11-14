// ESG Stock Tracker - Main JavaScript Logic

// Search stock when user clicks search button or presses Enter
function searchStock() {
    const input = document.getElementById('ticker-input');
    const ticker = input.value.trim().toUpperCase();
    
    if (!ticker) {
        showError('Please enter a stock ticker');
        return;
    }
    
    const esgData = getESGData(ticker);
    
    if (esgData) {
        displayESGData(esgData);
        hideError();
        hideWelcome();
    } else {
        showError();
        hideResults();
    }
}

// Display ESG data on the page
function displayESGData(data) {
    // Show results section
    const resultsSection = document.getElementById('results-section');
    resultsSection.classList.remove('hidden');
    
    // Display company header
    document.getElementById('company-name').textContent = 
        `${data.companyName} (${data.ticker})`;
    document.getElementById('company-meta').textContent = 
        `${data.industry} · Updated: ${data.lastUpdated}`;
    
    // Calculate and display overall score
    const overallScore = calculateOverallScore(data);
    document.getElementById('overall-score').textContent = `${overallScore}/100`;
    document.getElementById('score-rating').textContent = getScoreRating(overallScore);
    
    // Display Environmental score
    displayCategoryScore(
        'env',
        data.environmental.score,
        data.environmental.activities
    );
    
    // Display Social score
    displayCategoryScore(
        'social',
        data.social.score,
        data.social.activities
    );
    
    // Display Governance score
    displayCategoryScore(
        'gov',
        data.governance.score,
        data.governance.activities
    );
    
    // Display last updated
    document.getElementById('last-updated').textContent = 
        `Data last updated: ${data.lastUpdated} | Sample data for educational purposes`;
    
    // Smooth scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Display individual category (E, S, or G) score and activities
function displayCategoryScore(category, score, activities) {
    // Update score display
    document.getElementById(`${category}-score`).textContent = `${score}/100`;
    
    // Update progress bar
    const progressBar = document.querySelector(`#${category}-bar .progress-fill`);
    // Animate progress bar
    setTimeout(() => {
        progressBar.style.width = `${score}%`;
    }, 100);
    
    // Update activities list
    const activitiesList = document.getElementById(`${category}-activities`);
    activitiesList.innerHTML = '';
    activities.forEach(activity => {
        const li = document.createElement('li');
        li.textContent = activity;
        activitiesList.appendChild(li);
    });
}

// Show error message
function showError(customMessage) {
    const errorMessage = document.getElementById('error-message');
    if (customMessage) {
        errorMessage.querySelector('p').textContent = `❌ ${customMessage}`;
    } else {
        errorMessage.querySelector('p').textContent = 
            '❌ Stock ticker not found. Please try one of the available stocks.';
    }
    errorMessage.classList.remove('hidden');
}

// Hide error message
function hideError() {
    document.getElementById('error-message').classList.add('hidden');
}

// Hide results section
function hideResults() {
    document.getElementById('results-section').classList.add('hidden');
}

// Hide welcome message
function hideWelcome() {
    document.getElementById('welcome-message').classList.add('hidden');
}

// Add Enter key support for search input
document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('ticker-input');
    
    input.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            searchStock();
        }
    });
    
    // Auto-focus on input field
    input.focus();
    
    // Reset progress bars on page load
    document.querySelectorAll('.progress-fill').forEach(bar => {
        bar.style.width = '0%';
    });
});

// Optional: Add some sample searches for demo purposes
function loadSampleStock(ticker) {
    document.getElementById('ticker-input').value = ticker;
    searchStock();
}

// Optional: Quick search buttons (can be added to HTML if desired)
function createQuickSearchButtons() {
    const sampleTickers = ['AAPL', 'MSFT', 'TSLA', 'GOOGL'];
    // This function can be extended to add quick search buttons
}

// Utility function: Format score color based on value
function getScoreColor(score) {
    if (score >= 90) return '#10b981'; // Green
    if (score >= 80) return '#3b82f6'; // Blue
    if (score >= 70) return '#f59e0b'; // Orange
    if (score >= 60) return '#ef4444'; // Red
    return '#991b1b'; // Dark red
}

// Future enhancement: Log searches for analytics
function logSearch(ticker) {
    // In future versions, this could send data to an analytics service
    console.log(`Search performed for: ${ticker}`);
}

// Export functions for potential future use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        searchStock,
        displayESGData,
        getScoreColor
    };
}
