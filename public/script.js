let translations = {};
let currentLang = "en";

async function loadLanguage(lang) {
  const res = await fetch("lang.json");
  translations = await res.json();
  currentLang = lang;
  applyTranslations();
}

function applyTranslations() {
  const t = translations[currentLang] || {};

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (t[key]) el.textContent = t[key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (t[key]) el.placeholder = t[key];
  });

  // Update flag
  const selected = document.querySelector(`#langSelect option[value="${currentLang}"]`);
  const flagCode = selected.getAttribute("data-flag");
  document.getElementById("flagIcon").src = `https://flagcdn.com/w40/${flagCode}.png`;
}

document.getElementById("langSelect").addEventListener("change", (e) => {
  currentLang = e.target.value;
  applyTranslations();
});

document.getElementById("generateBtn").addEventListener("click", async () => {
  const input = document.getElementById("inputText").value;
  const output = document.getElementById("output");
  console.log("Input text:", input);
  if (input) {
    output.textContent = "Cooking up... please wait...";
    await askGemini(input, output);
  } else {
    alert("Please enter a geometry problem.");
  }
});

// Add toggle functionality for code display
document.getElementById("toggleCodeBtn").addEventListener("click", () => {
  const outputContainer = document.getElementById("outputContainer");
  const toggleBtn = document.getElementById("toggleCodeBtn");

  if (outputContainer.classList.contains("hidden")) {
    outputContainer.classList.remove("hidden");
    toggleBtn.textContent = translations[currentLang]?.hideCodeBtn || "Hide Code";
  } else {
    outputContainer.classList.add("hidden");
    toggleBtn.textContent = translations[currentLang]?.showCodeBtn || "Show Code";
  }
});

// Store previous diagram code and successful code
let previousCode = "";
let lastSuccessfulCode = "";
let lastSuccessfulBoard = null;

// Modified askGemini function to include previous code
async function askGemini(inputText, outputElement) {
  try {
    const usePreviousCode = document.getElementById('continueModeToggle').checked;
    
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        input: inputText,
        previousCode: usePreviousCode ? previousCode : "" 
      })
    });
    
    const data = await res.json();
    if (data.result) {
      outputElement.innerHTML = marked.parse(data.result);
      const cleanCode = data.result.trim().replace(/```(js|javascript)?|```/g, "");
      
      // Save the current code for potential future use
      previousCode = cleanCode;
      
      // Try to run the new code, but keep previous successful state if it fails
      if (!runJSXGraph(cleanCode)) {
        // If drawing failed, restore last successful code in the output
        if (lastSuccessfulCode) {
          console.log("Drawing failed, restoring previous successful diagram");
          outputElement.innerHTML = marked.parse("```javascript\n" + lastSuccessfulCode + "\n```");
          previousCode = lastSuccessfulCode; // Keep using last successful code
        }
      }
      
      // Enable the export button when diagram is successfully generated
      document.getElementById('exportBtn').disabled = false;
      document.getElementById('toggleCodeBtn').disabled = false;
    } else {
      alert("No result.");
    }
  } catch (err) {
    console.error(err);
    alert("Error connecting to Gemini server.");
  }
}

function runJSXGraph(code) {
  const container = document.getElementById("jxgbox");
  
  // Create a temporary invisible container to test the code
  const testContainer = document.createElement('div');
  testContainer.style.display = 'none';
  testContainer.id = 'test-jxgbox';
  document.body.appendChild(testContainer);
  
  try {
    // Try to run the new code in test container first
    const testBoard = JXG.JSXGraph.initBoard("test-jxgbox", {
      boundingbox: [-10, 10, 10, -10],
      axis: false
    });
    
    const f = new Function("board", code);
    f(testBoard);
    
    // If successful, update the real container
    container.innerHTML = "";
    const board = JXG.JSXGraph.initBoard("jxgbox", {
      boundingbox: [-10, 10, 10, -10],
      axis: false
    });
    
    f(board);
    
    // Store the successful code and board state
    lastSuccessfulCode = code;
    lastSuccessfulBoard = board;
    
    // Cleanup test container
    document.body.removeChild(testContainer);
    return true;
  } catch (err) {
    console.error("JSXGraph code error:", err);
    alert("Failed to render diagram. Keeping previous diagram.");
    
    // Cleanup test container
    document.body.removeChild(testContainer);
    
    // Keep the previous diagram (do nothing to the container)
    return false;
  }
}

// Dark mode = default Dracula
document.body.classList.add("dark");

// Load and apply EN
loadLanguage("en");

// Add these functions to your existing JS file
document.addEventListener('DOMContentLoaded', function () {
  const generateBtn = document.getElementById('generateBtn');
  const toggleCodeBtn = document.getElementById('toggleCodeBtn');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const outputContainer = document.getElementById('outputContainer');

  // Initially disable toggle code button
  toggleCodeBtn.disabled = true;

  generateBtn.addEventListener('click', async function () {
    const inputText = document.getElementById('inputText').value;
    if (!inputText.trim()) return;

    // Show loading spinner
    loadingSpinner.classList.remove('hidden');
    // Hide output if visible
    outputContainer.classList.add('hidden');

    try {
      // Your existing API fetch code here
      // Example:
      // const response = await fetch('/api/generate', {
      //    method: 'POST',
      //    body: JSON.stringify({ input: inputText }),
      //    headers: { 'Content-Type': 'application/json' }
      // });
      // const data = await response.json();

      // After successful response:
      // Process your data here

      // Enable toggle code button if code is available
      toggleCodeBtn.disabled = false;
    } catch (error) {
      console.error('Error:', error);
      // Handle error
    } finally {
      // Hide loading spinner
      loadingSpinner.classList.add('hidden');
    }
  });
});

// Add loading state handling for the generate button

document.addEventListener('DOMContentLoaded', function () {
  const generateBtn = document.getElementById('generateBtn');
  const toggleCodeBtn = document.getElementById('toggleCodeBtn');
  const loadingSpinner = document.getElementById('loadingSpinner');

  generateBtn.addEventListener('click', async function () {
    const inputText = document.getElementById('inputText').value;
    if (!inputText.trim()) return;

    // Show loading state
    generateBtn.classList.add('is-loading');
    generateBtn.disabled = true;
    loadingSpinner.classList.remove('hidden');

    try {
      // Your API fetch code here
      // Simulate API call with timeout for testing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Process response
      toggleCodeBtn.disabled = false; // Enable toggle code button when response has code

    } catch (error) {
      console.error('Error:', error);
      // Handle error 
    } finally {
      // Reset loading state
      generateBtn.classList.remove('is-loading');
      generateBtn.disabled = false;
      loadingSpinner.classList.add('hidden');
    }
  });
});

document.addEventListener('DOMContentLoaded', function () {
  const generateBtn = document.getElementById('generateBtn');
  const toggleCodeBtn = document.getElementById('toggleCodeBtn');
  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');
  const inputText = document.getElementById('inputText');
  const jxgbox = document.getElementById('jxgbox');
  const outputContainer = document.getElementById('outputContainer');
  const loadingSpinner = document.getElementById('loadingSpinner');

  // Export PNG functionality
  exportBtn.addEventListener('click', function() {
    exportDiagramAsPNG();
  });

  // Function to export diagram as PNG
  function exportDiagramAsPNG() {
    // Create a loading state
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<i data-lucide="loader" class="btn-icon animate-spin"></i><span>Exporting...</span>';
    lucide.createIcons(); // Refresh icons

    // Use html2canvas to capture the JSXGraph board
    html2canvas(document.getElementById('jxgbox'), {
      backgroundColor: null, // Transparent background
      scale: 2 // Higher resolution
    }).then(function(canvas) {
      // Create a download link
      const link = document.createElement('a');
      link.download = 'sketchmath-diagram.png';
      link.href = canvas.toDataURL('image/png');
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Reset button state
      exportBtn.disabled = false;
      exportBtn.innerHTML = '<i data-lucide="download" class="btn-icon"></i><span>Export PNG</span>';
      lucide.createIcons(); // Refresh icons
    }).catch(function(error) {
      console.error('Error exporting diagram:', error);
      alert('Failed to export diagram. Please try again.');
      
      // Reset button state
      exportBtn.disabled = false;
      exportBtn.innerHTML = '<i data-lucide="download" class="btn-icon"></i><span>Export PNG</span>';
      lucide.createIcons(); // Refresh icons
    });
  }

  // Clear button functionality
  clearBtn.addEventListener('click', function () {
    // Clear input text
    inputText.value = '';

    // Clear jxgbox
    jxgbox.innerHTML = '';

    // Reset previous code
    previousCode = "";

    // Reset toggle to unchecked
    document.getElementById('continueModeToggle').checked = false;

    // Hide output if visible
    outputContainer.classList.add('hidden');

    // Disable toggle code and export buttons
    toggleCodeBtn.disabled = true;
    exportBtn.disabled = true;

    // Focus on input area
    inputText.focus();
  });

  // Existing generate button event listener and other code...
});

// Modify the existing generateBtn click event to enable the export button
document.addEventListener('DOMContentLoaded', function () {
  const generateBtn = document.getElementById('generateBtn');
  const toggleCodeBtn = document.getElementById('toggleCodeBtn');
  const exportBtn = document.getElementById('exportBtn');
  const loadingSpinner = document.getElementById('loadingSpinner');

  generateBtn.addEventListener('click', async function () {
    const inputText = document.getElementById('inputText').value;
    if (!inputText.trim()) return;

    // Show loading state
    generateBtn.classList.add('is-loading');
    generateBtn.disabled = true;
    loadingSpinner.classList.remove('hidden');

    try {
      // Your API fetch code here
      // Simulate API call with timeout for testing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Process response
      toggleCodeBtn.disabled = false; // Enable toggle code button when response has code
      exportBtn.disabled = false; // Enable export button when diagram is generated

    } catch (error) {
      console.error('Error:', error);
      // Handle error 
    } finally {
      // Reset loading state
      generateBtn.classList.remove('is-loading');
      generateBtn.disabled = false;
      loadingSpinner.classList.add('hidden');
    }
  });
});
