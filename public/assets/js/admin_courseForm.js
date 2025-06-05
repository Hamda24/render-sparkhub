import { showToast } from './toast.js';

const form        = document.getElementById('courseForm');
const titleEl     = document.getElementById('title');
const descEl      = document.getElementById('description');
const thumbEl     = document.getElementById('thumbnail');
const tutorSelect = document.getElementById('tutor_id');
const cancelBtn   = document.getElementById('cancelBtn');
const formTitle   = document.getElementById('formTitle');
const jwt         = localStorage.getItem('jwt');

let courseId = null;

// Utility: get query param
function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

// Load tutors to dropdown (unchanged)
async function loadTutors() {
  try {
    const res = await fetch('/api/admin/users?role=tutor', {
      headers: { 'Authorization': 'Bearer ' + jwt }
    });
    const { users } = await res.json();
    tutorSelect.innerHTML = users.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  } catch (err) {
    console.error('Failed to load tutors', err);
    showToast('Error loading tutors', 'error');
  }
}

// If editing, fetch and fill (we’ll leave thumbnail blank)
async function loadCourse(id) {
  try {
    const res = await fetch(`/api/admin/courses/${id}`, {
      headers: { 'Authorization': 'Bearer ' + jwt }
    });
    if (!res.ok) throw new Error();
    const { course } = await res.json();
    titleEl.value     = course.title;
    descEl.value      = course.description || '';
    // We do NOT prefill <input type="file"> (leave it blank)
    tutorSelect.value = course.tutor_id;
    formTitle.textContent = 'Edit Course';
  } catch {
    showToast('Failed to load course details', 'error');
  }
}

// Submit handler: use FormData
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Build a FormData instead of JSON
  const formData = new FormData();
  formData.append('title', titleEl.value.trim());
  formData.append('description', descEl.value.trim());
  formData.append('tutor_id', tutorSelect.value);

  // If a file is selected, append it; otherwise skip
  if (thumbEl.files && thumbEl.files[0]) {
    formData.append('thumbnail', thumbEl.files[0]);
  }

  try {
    let res;
    if (courseId) {
      res = await fetch(`/api/admin/courses/${courseId}`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + jwt
          // Note: no 'Content-Type' header here—fetch will set it automatically for FormData
        },
        body: formData
      });
    } else {
      res = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + jwt
        },
        body: formData
      });
    }

    if (!res.ok) throw new Error();
    showToast(courseId ? 'Course updated' : 'Course created', 'success');
    setTimeout(() => window.location.href = '/admin_courses.html', 1000);
  } catch {
    showToast('Failed to save course', 'error');
  }
});

// Cancel button
cancelBtn.addEventListener('click', () => {
  window.location.href = '/admin_courses.html';
});

// On load, populate tutors and check for ?id=
(async () => {
  await loadTutors();
  courseId = getParam('id');
  if (courseId) {
    await loadCourse(courseId);
  }
})();