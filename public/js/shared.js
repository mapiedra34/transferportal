// public/js/shared.js

// Where your API is running.
// For dev: Node API is on http://localhost:4000
// For prod (Static Web Apps), you might later change this to "/api"
const API_BASE = "http://localhost:4000";

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
}
