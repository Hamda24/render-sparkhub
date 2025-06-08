import { showToast } from "./toast.js";

const params = new URLSearchParams(window.location.search);
const courseId = params.get("courseId");
const jwt = localStorage.getItem("jwt");
const API_BASE = "/api/tutor";

if (!courseId) {
  showToast("Missing courseId in URL", "error");
  throw new Error("courseId is required");
}

// Grab DOM elements
const pageTitle   = document.getElementById("pageTitle");
const contentList = document.getElementById("contentList");
const form        = document.getElementById("contentForm");

// Helper for attaching the “Authorization” header
function authHeaders(extra = {}) {
  return {
    Authorization: "Bearer " + jwt,
    ...extra,
  };
}

// 1) Fetch the course title and set it in the H1
async function setPageTitle() {
  try {
    const res = await fetch(`${API_BASE}/courses/${courseId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error();
    const { course } = await res.json();
    pageTitle.textContent = `Manage Content for “${course.title}”`;
  } catch {
    pageTitle.textContent = `Manage Content (Course ID: ${courseId})`;
  }
}
setPageTitle();

// 2) Load & render all content items for this course
async function loadItems() {
  try {
    const res = await fetch(`${API_BASE}/courses/${courseId}/content`, {
      headers: authHeaders(),
    });
    if (res.status === 403) return showToast("Not authorized", "error");
    if (!res.ok) return showToast("Failed to load items", "error");

    const { items } = await res.json();
    if (!items || !items.length) {
      contentList.innerHTML = `<p class="no-content">No content uploaded yet.</p>`;
      return;
    }

    // Build one “card” per item
    contentList.innerHTML = items
      .map((item) => {
        const iconClass = item.type === "video" ? "fa-play" : "fa-file-pdf";
        const typeLabel = item.type.toUpperCase();
        return `
        <div class="content-card" draggable="true" data-id="${item.id}" data-type="${item.type}">
          <div class="content-card-body">
            <i class="fas ${iconClass} content-icon"></i>
            <h3>${item.title}</h3>
            <div class="content-type">(${typeLabel})</div>
          </div>
          <div class="content-card-actions">
            <!-- Preview button -->
            <button class="btn-preview" data-id="${item.id}" title="Preview">
              <i class="fas fa-eye"></i>
            </button>
            <!-- Download button (PDF only) -->
            <button class="btn-download" data-id="${item.id}" title="Download">
              <i class="fas fa-download"></i>
            </button>
            <!-- Delete button -->
            <button class="btn-delete" data-id="${item.id}" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    attachHandlers();
    enableDragAndDrop();
  } catch (err) {
    console.error(err);
    showToast("Failed to load items", "error");
  }
}

// 3) Handle the form submission (upload new content)
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // === IMPORTANT: Use new FormData(form) only once ===
  // That automatically picks up:
  //   • title  (input[name="title"])
  //   • type   (select[name="type"])
  //   • file   (input[name="file"])
  //
  // Do NOT call formData.append("file", …) again, or you’ll send two “file” fields.
  const formData = new FormData(form);
    const fileInput = form.querySelector('input[name="file"]');
  const selectedFile = fileInput.files[0];

  // 2) If it’s a video, show the “Uploading…” toast right away
  if (selectedFile && selectedFile.type.startsWith("video/")) {
    showToast("Uploading video… this may take a few seconds", "info");
  }

  try {
    const res = await fetch(`${API_BASE}/courses/${courseId}/content`, {
      method: "POST",
      headers: authHeaders(), // Multer will parse the multipart body
      body: formData,
    });
    if (res.status === 403)
      return showToast("Not authorized", "error");
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return showToast(errJson.error || "Upload failed", "error");
    }
    showToast("Uploaded successfully", "success");
    form.reset();
    loadItems();
  } catch (err) {
    console.error(err);
    showToast("Upload failed", "error");
  }
});

// 4) Attach handlers to each card’s buttons (preview / download / delete)
function attachHandlers() {
  // Preview button ⇒ open raw endpoint in a new tab
  document.querySelectorAll(".btn-preview").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      window.open(
        `/api/tutor/content/${id}/raw?token=${jwt}`,
        "_blank"
      );
    };
  });

  // Download button ⇒ force immediate download
  document.querySelectorAll(".btn-download").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      // Simply change window.location.href to the “raw?download=1” URL:
      // the browser will immediately prompt “Save As…”
      window.location.href = `/api/tutor/content/${id}/raw?token=${jwt}&download=1`;
    };
  });

  // Delete button ⇒ call DELETE and then reload
  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      // If you want to show a confirmation toast instead of a JS confirm(), you can replace this:
      // if (!confirm("Delete this content?")) return;
      try {
        const res = await fetch(`${API_BASE}/content/${id}`, {
          method: "DELETE",
          headers: authHeaders(),
        });
        if (res.status === 403)
          return showToast("Not authorized", "error");
        if (!res.ok) return showToast("Delete failed", "error");

        showToast("Deleted", "success");
        loadItems();
      } catch (err) {
        console.error(err);
        showToast("Delete failed", "error");
      }
    };
  });
}

// 5) Drag & drop reordering (optional, if you want reorder)
function enableDragAndDrop() {
  let dragSrc = null;
  document
    .querySelectorAll(".content-card")
    .forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        dragSrc = card;
        e.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragover", (e) => e.preventDefault());
      card.addEventListener("drop", () => {
        if (dragSrc && dragSrc !== card) {
          contentList.insertBefore(dragSrc, card.nextSibling);
          saveOrder();
        }
      });
    });
}

// Save the new order back to server
async function saveOrder() {
  const items = Array.from(contentList.children).map((card, idx) => ({
    id: card.dataset.id,
    display_order: idx,
  }));

  try {
    const res = await fetch(`${API_BASE}/content/reorder`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ items }),
    });
    if (res.status === 403)
      return showToast("Not authorized", "error");
    if (!res.ok) return showToast("Reorder failed", "error");

    showToast("Order saved", "success");
  } catch (err) {
    console.error(err);
    showToast("Reorder failed", "error");
  }
}

// 6) Initial load
loadItems();
