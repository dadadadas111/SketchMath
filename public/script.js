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

async function askGemini(inputText, outputElement) {
  try {
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: inputText })
    });
    const data = await res.json();
    if (data.result) {
      outputElement.innerHTML = marked.parse(data.result);
      const cleanCode = data.result.trim().replace(/```(js|javascript)?|```/g, "");
      runJSXGraph(cleanCode);
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
  container.innerHTML = ""; // Clear previous content

  const board = JXG.JSXGraph.initBoard("jxgbox", {
    boundingbox: [-10, 10, 10, -10],
    axis: false // Disable axis
  });

  try {
    // Run the Gemini-generated JSXGraph code
    const f = new Function("board", code);
    f(board);
  } catch (err) {
    console.error("JSXGraph code error:", err);
    alert("Failed to render JSXGraph jxgbox.");
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
  const inputText = document.getElementById('inputText');
  const jxgbox = document.getElementById('jxgbox');
  const outputContainer = document.getElementById('outputContainer');
  const loadingSpinner = document.getElementById('loadingSpinner');

  // Clear button functionality
  clearBtn.addEventListener('click', function () {
    // Clear input text
    inputText.value = '';

    // Clear jxgbox
    jxgbox.innerHTML = '';

    // Hide output if visible
    outputContainer.classList.add('hidden');

    // Disable toggle code button as there's no code to show
    toggleCodeBtn.disabled = true;

    // Focus on input area
    inputText.focus();
  });

  // Existing generate button event listener and other code...
});
