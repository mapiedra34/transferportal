// public/js/manager.js

// API_BASE is defined in shared.js
const REQUESTS_URL = `${API_BASE}/api/requests`;

const columns = {
  received: document.getElementById("receivedList"),
  "in-review": document.getElementById("inReviewList"),
  approved: document.getElementById("approvedList"),
  denied: document.getElementById("deniedList")
};

const counts = {
  received: document.getElementById("receivedCount"),
  "in-review": document.getElementById("inReviewCount"),
  approved: document.getElementById("approvedCount"),
  denied: document.getElementById("deniedCount")
};

// Modal elements
let denyModal;
let denyReasonInput;
let denyConfirmBtn;
let denyCancelBtn;
let pendingDenyId = null;

function enforceRole() {
  const role = localStorage.getItem("userRole");
  const email = localStorage.getItem("userEmail");

  if (!role || !email) {
    window.location.href = "index.html";
    return;
  }

  if (role !== "manager") {
    window.location.href = "technician.html";
  }
}

function openDenyModal(id) {
  pendingDenyId = id;
  denyReasonInput.value = "";
  denyModal.classList.add("visible");
  denyReasonInput.focus();
}

function closeDenyModal() {
  pendingDenyId = null;
  denyModal.classList.remove("visible");
}

function buildRequestCard(req) {
  const template = document.getElementById("requestCardTemplate");
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".request-card");

  const requesterEl = fragment.querySelector(".requester");
  const routeEl = fragment.querySelector(".route");
  const shiftEl = fragment.querySelector(".shift");
  const submittedEl = fragment.querySelector(".submitted");
  const updatedEl = fragment.querySelector(".updated");
  const notesEl = fragment.querySelector(".notes");

  const actions = fragment.querySelector(".status-actions");
  const btnInReview = actions.querySelector('[data-status="in-review"]');
  const btnApprove = actions.querySelector('[data-status="approved"]');
  const btnDeny = actions.querySelector('[data-status="denied"]');

  requesterEl.textContent = req.email || req.employeeName || "Unknown requester";
  routeEl.textContent = `${req.currentSite} → ${req.preferredSite}`;
  shiftEl.textContent = req.preferredShift || "";

  submittedEl.textContent = `Submitted: ${
    req.submittedAt ? formatDate(req.submittedAt) : "—"
  }`;
  updatedEl.textContent = `Updated: ${
    req.updatedAt ? formatDate(req.updatedAt) : "—"
  }`;

  notesEl.textContent = req.notes || "";
  card.dataset.id = req.id;

  if (req.status === "received") {
    // Only In Review
    btnApprove.remove();
    btnDeny.remove();
    btnInReview.addEventListener("click", () => updateStatus(req.id, "in-review"));
  } else if (req.status === "in-review") {
    // Approve or Deny
    btnInReview.remove();
    btnApprove.addEventListener("click", () => updateStatus(req.id, "approved"));
    btnDeny.addEventListener("click", () => openDenyModal(req.id));
  } else {
    // Approved or Denied → final compact card, no buttons
    actions.remove();
    card.classList.add("request-card--final");

    const name = req.employeeName || req.email || "Employee";

    if (req.status === "approved") {
      requesterEl.textContent = `Moving to ${req.preferredSite}`;
      routeEl.textContent = req.preferredShift || "";
    } else if (req.status === "denied") {
      requesterEl.textContent = `${name} — Transfer request denied`;

      // Show denial reason but collapsed by default
      const reason = req.denialReason || "No reason provided.";
      notesEl.textContent = reason;
      notesEl.style.display = "none";
      notesEl.classList.add("denial-reason");

      routeEl.textContent = "";
      shiftEl.textContent = "";

      // Clicking the name toggles the reason
      requesterEl.style.cursor = "pointer";
      requesterEl.addEventListener("click", () => {
        const hidden = notesEl.style.display === "none";
        notesEl.style.display = hidden ? "block" : "none";
      });
    }

    // Hide updated line for cleaner final state
    updatedEl.style.display = "none";
  }

  return fragment;
}

async function fetchRequestsByStatus(status) {
  const url = `${REQUESTS_URL}?status=${encodeURIComponent(status)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("Failed to fetch requests", err);
    throw new Error("Failed to fetch requests");
  }
  return res.json();
}

async function updateStatus(id, newStatus, denialReason) {
  try {
    const body = { status: newStatus };
    if (newStatus === "denied" && denialReason) {
      body.denialReason = denialReason;
    }

    const res = await fetch(`${REQUESTS_URL}/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Failed to update status", err);
      alert(err.error || "Failed to update status. Please try again.");
      return;
    }

    await res.json();
    await renderBoard();
  } catch (err) {
    console.error("Network error updating status", err);
    alert("Network error updating status. Please check your connection.");
  }
}

async function renderBoard() {
  Object.values(columns).forEach((col) => (col.innerHTML = ""));
  Object.keys(counts).forEach((key) => (counts[key].textContent = "0"));

  try {
    const [received, inReview, approved, denied] = await Promise.all([
      fetchRequestsByStatus("received"),
      fetchRequestsByStatus("in-review"),
      fetchRequestsByStatus("approved"),
      fetchRequestsByStatus("denied")
    ]);

    const buckets = {
      received,
      "in-review": inReview,
      approved,
      denied
    };

    Object.entries(buckets).forEach(([status, list]) => {
      const col = columns[status];
      counts[status].textContent = list.length.toString();
      list.forEach((req) => col.appendChild(buildRequestCard(req)));
    });
  } catch (err) {
    console.error("Error rendering board", err);
    alert("Failed to load requests from the server.");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  enforceRole();

  // Wire modal elements
  denyModal = document.getElementById("denyModal");
  denyReasonInput = document.getElementById("denyReasonInput");
  denyConfirmBtn = document.getElementById("denyConfirmBtn");
  denyCancelBtn = document.getElementById("denyCancelBtn");

  denyCancelBtn.addEventListener("click", () => {
    closeDenyModal();
  });

  denyConfirmBtn.addEventListener("click", async () => {
    const reason = denyReasonInput.value.trim();
    if (!reason) {
      alert("Please provide a reason for denial.");
      return;
    }
    const id = pendingDenyId;
    if (!id) {
      closeDenyModal();
      return;
    }
    await updateStatus(id, "denied", reason);
    closeDenyModal();
  });

  // Optional: close on backdrop click
  denyModal.addEventListener("click", (e) => {
    if (e.target === denyModal) {
      closeDenyModal();
    }
  });

  renderBoard();
});
