// public/js/shared.js

const API_BASE = "/api";


// Constants shared across pages
const MANAGER_DOMAIN = "microsoft.com";

const siteOptions = ["SN", "SAT"];
const shiftOptions = [
  "A Side Days",
  "B Side Days",
  "A Side Nights",
  "B Side Nights",
  "STRIKE Team"
];

// Utility: format ISO or epoch timestamps into a readable string
function formatDate(timestamp) {
  const d =
    typeof timestamp === "string" ? new Date(timestamp) : new Date(Number(timestamp));
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}window.addEventListener("DOMContentLoaded", () => {
  let signOutLink = null;

  // Find any <a> containing "Sign out"
  document.querySelectorAll("a").forEach(a => {
    if (a.textContent.trim().toLowerCase() === "sign out") {
      signOutLink = a;
    }
  });

  if (!signOutLink) return;

  signOutLink.addEventListener("click", (e) => {
    e.preventDefault();

    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");

    window.location.href = "index.html";
  });
});


