const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");



function handleLogin(e) {
  e.preventDefault();
  const formData = new FormData(loginForm);
  const email = formData.get("email").trim().toLowerCase();
  const role = formData.get("role");

  if (!email.endsWith(`@${MANAGER_DOMAIN}`)) {
    alert("Use your Microsoft work email (@microsoft.com).");
    return;
  }

  localStorage.setItem("userEmail", email);
  localStorage.setItem("userRole", role);

  if (role === "manager") {
    window.location.href = "manager.html";
  } else {
    window.location.href = "technician.html";
  }
}

loginForm.addEventListener("submit", handleLogin);

// If already signed in, route to their last role.
window.addEventListener("DOMContentLoaded", () => {
  const email = localStorage.getItem("userEmail");
  const role = localStorage.getItem("userRole");
  if (email && role) {
    if (role === "manager") {
      window.location.href = "manager.html";
    } else {
      window.location.href = "technician.html";
    }
  }
});
