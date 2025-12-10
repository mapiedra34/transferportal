// public/js/technician.js

// API base is defined globally in shared.js:
// const API_BASE = "http://localhost:4000";
const REQUESTS_URL = `${API_BASE}/api/requests`;

function setGreeting() {
  const hour = new Date().getHours();
  const salutation =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  document.getElementById(
    "greeting"
  ).textContent = `${salutation}, please complete your transfer details`;
}

function populateSelect(selectEl, options) {
  selectEl.innerHTML = "";
  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option;
    opt.textContent = option;
    selectEl.appendChild(opt);
  });
}

function enforceRole() {
  const role = localStorage.getItem("userRole");
  const email = localStorage.getItem("userEmail");

  // Not signed in → go back to login
  if (!role || !email) {
    window.location.href = "index.html";
    return;
  }

  // Managers shouldn’t be on this page
  if (role === "manager") {
    window.location.href = "manager.html";
  }
}

async function handleSubmit(e) {
  e.preventDefault();

  const form = document.getElementById("requestForm");
  const formData = new FormData(form);

  const payload = {
    email: formData.get("email")?.trim().toLowerCase(),
    currentSite: formData.get("currentSite"),
    preferredSite: formData.get("preferredSite"),
    preferredShift: formData.get("preferredShift"),
    notes: formData.get("notes")?.trim() || ""
  };

  if (
    !payload.email ||
    !payload.currentSite ||
    !payload.preferredSite ||
    !payload.preferredShift
  ) {
    alert("Please fill out all required fields.");
    return;
  }

  try {
    const res = await fetch(REQUESTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Failed to submit request", err);
      alert(
        "Something went wrong submitting your request. Please try again or contact your manager."
      );
      return;
    }

    await res.json(); // created resource (not used yet)

    alert("Your transfer request has been submitted.");
    form.reset();

    // Re-fill dropdowns & email after reset
    populateSelect(document.getElementById("currentSite"), siteOptions);
    populateSelect(document.getElementById("preferredSite"), siteOptions);
    populateSelect(document.getElementById("preferredShift"), shiftOptions);

    const storedEmail = localStorage.getItem("userEmail");
    if (storedEmail) {
      document.getElementById("email").value = storedEmail;
    }
  } catch (err) {
    console.error("Network error submitting request", err);
    alert(
      "Network error submitting your request. Please check your connection and try again."
    );
  }
}

window.addEventListener("DOMContentLoaded", () => {
  enforceRole();
  setGreeting();

  populateSelect(document.getElementById("currentSite"), siteOptions);
  populateSelect(document.getElementById("preferredSite"), siteOptions);
  populateSelect(document.getElementById("preferredShift"), shiftOptions);

  const email = localStorage.getItem("userEmail");
  if (email) {
    document.getElementById("email").value = email;
  }

  document
    .getElementById("requestForm")
    .addEventListener("submit", handleSubmit);
});
