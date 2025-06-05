import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('coursesTable');
  const newCourseBtn = document.getElementById('newCourseBtn');
  const jwt = localStorage.getItem('jwt');

  // Load & render courses
  async function loadCourses() {
    try {
      const res = await fetch('/api/admin/courses', {
        headers: { 'Authorization': 'Bearer ' + jwt }
      });
      if (!res.ok) throw new Error();
      const { courses } = await res.json();
      tableBody.innerHTML = courses.map(c => `
        <tr>
          <td>${c.title}</td>
          <td>${c.tutorName}</td>
          <td>${new Date(c.createdAt).toLocaleDateString()}</td>
          <td class="actions">
            <button data-id="${c.id}" class="btn-sm edit">✏️</button>
            <button data-id="${c.id}" class="btn-sm manage" title="Manage Content">
              <i class="fas fa-folder-open"></i>
            </button>
              
            <button data-id="${c.id}" class="btn-sm delete">🗑️</button>
          </td>
        </tr>
      `).join('');
      attachRowHandlers();
    } catch {
      tableBody.innerHTML = `
        <tr><td colspan="4" class="error">
          Could not load courses. Try again later.
        </td></tr>`;
    }
  }

  // Hook up create button
  newCourseBtn.addEventListener('click', () => {
    window.location.href = '/admin_courseForm.html';
  });

  // Edit/Delete/Manage row buttons
  function attachRowHandlers() {
    // Edit
    document.querySelectorAll('.btn-sm.edit')
      .forEach(btn => btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        window.location.href = `/admin_courseForm.html?id=${id}`;
      }));

    // Delete
    document.querySelectorAll('.btn-sm.delete')
      .forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          const res = await fetch(`/api/admin/courses/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + jwt }
          });
          if (!res.ok) return showToast("Delete failed", "error");
          showToast('Deleted');
          loadCourses();
        } catch {
          showToast('Failed to delete.');
        }
      }));

    // Manage Content
    document.querySelectorAll('.btn-sm.manage')
      .forEach(btn => btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        // Navigate to the content page for that course
        window.location.href = `/admin_content.html?courseId=${id}`;
      }));

    //Quizzes
    document.querySelectorAll('.btn-sm.quiz').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        window.location.href = `/admin_quizForm.html?courseId=${id}`;
      });
    });
  }

  loadCourses();
});
