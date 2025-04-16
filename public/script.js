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
  // alert("Next step: send to Gemini and draw!");
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
      // document.getElementById("diagram").innerText = data.result;
    } else {
      alert("No result.");
    }
  } catch (err) {
    console.error(err);
    alert("Error connecting to Gemini server.");
  }
}


// Dark mode = default Dracula
document.body.classList.add("dark");

// Load and apply EN
loadLanguage("en");
