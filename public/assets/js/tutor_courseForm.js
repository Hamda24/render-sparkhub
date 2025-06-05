import { showToast } from './toast.js';

const form      = document.getElementById('courseForm');
const titleEl   = document.getElementById('title');
const descEl    = document.getElementById('description');
const thumbEl   = document.getElementById('thumbnail');
const cancelBtn = document.getElementById('cancelBtn');
const formTitle = document.getElementById('formTitle');
const jwt       = localStorage.getItem('jwt');

let courseId = null;

// If editing, fetch and fill (no tutor dropdown)
async function loadCourse(id) {
  try {
    const res = await fetch(`/api/tutor/courses/${id}`, {
      headers: { 'Authorization': 'Bearer ' + jwt }
    });
    if (!res.ok) throw new Error();
    const { course } = await res.json();
    titleEl.value  = course.title;
    descEl.value   = course.description || '';
    // <--- No tutorSelect here
    formTitle.textContent = 'Edit Course';
  } catch {
    showToast('Failed to load course details', 'error');
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Build FormData without tutor_id
  const formData = new FormData();
  formData.append('title', titleEl.value.trim());
  formData.append('description', descEl.value.trim());

  if (thumbEl.files && thumbEl.files[0]) {
    formData.append('thumbnail', thumbEl.files[0]);
  }

  try {
    let res;
    if (courseId) {
      // Update existing course
      res = await fetch(`/api/tutor/courses/${courseId}`, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + jwt },
        body: formData
      });
    } else {
      // Create new course
      res = await fetch('/api/tutor/courses', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + jwt },
        body: formData
      });
    }

    if (!res.ok) throw new Error();
    showToast(courseId ? 'Course updated' : 'Course created', 'success');
    setTimeout(() => (window.location.href = '/tutor_courses.html'), 1000);
  } catch {
    showToast('Failed to save course', 'error');
  }
});

cancelBtn.addEventListener('click', () => {
  window.location.href = '/tutor_courses.html';
});

(async () => {
  courseId = new URLSearchParams(window.location.search).get('id');
  if (courseId) {
    await loadCourse(courseId);
  }
})();