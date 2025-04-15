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

document.getElementById("generateBtn").addEventListener("click", () => {
  const input = document.getElementById("inputText").value;
  console.log("Input text:", input);
  alert("Next step: send to Gemini and draw!");
});

// Dark mode = default Dracula
document.body.classList.add("dark");

// Load and apply EN
loadLanguage("en");
