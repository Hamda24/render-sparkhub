import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('coursesContainer');
  const newCourseBtn = document.getElementById('newCourseBtn');
  const jwt = localStorage.getItem('jwt');

  async function loadCourses() {
    try {
      const res = await fetch('/api/tutor/courses', {
        headers: { 'Authorization': 'Bearer ' + jwt }
      });
      if (!res.ok) throw new Error();
      const { courses } = await res.json();

      container.innerHTML = courses.map(c => {
        const createdDate = new Date(c.createdAt).toLocaleDateString();
        return `
          <div class="course-card" data-id="${c.id}">
            <!-- (optional) <div class="card-thumb"><img src="..." /></div> -->

            <h3>${c.title}</h3>
            <div class="course-info">
              <div><strong>Created:</strong> ${createdDate}</div>
              <div><strong>Tutor:</strong> ${c.tutorName}</div>
            </div>

            <div class="course-actions">
              <button class="action-icon btn-edit" data-id="${c.id}" title="Edit">✏️</button>
              <button class="action-icon btn-manage" data-id="${c.id}" title="Manage Content">📂</button>
              <button class="action-icon btn-delete" data-id="${c.id}" title="Delete">🗑️</button>
            </div>
          </div>
        `;
      }).join('');

      attachCardHandlers();
    } catch {
      container.innerHTML = `<p class="error">Could not load courses. Try again later.</p>`;
    }
  }

  newCourseBtn.addEventListener('click', () => {
    window.location.href = '/tutor_courseForm.html';
  });

  function attachCardHandlers() {
    document.querySelectorAll('.btn-edit').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        window.location.href = `/tutor_courseForm.html?id=${id}`;
      })
    );
    document.querySelectorAll('.btn-manage').forEach(btn =>
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        window.location.href = `/tutor_content.html?courseId=${id}`;
      })
    );
  
    document.querySelectorAll('.btn-delete').forEach(btn =>
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          const res = await fetch(`/api/tutor/courses/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + jwt }
          });
           if (!res.ok) return showToast("Delete failed", "error");
          showToast('Deleted');
          loadCourses();
        } catch {
          showToast('Failed to delete.');
        }
      })
    );
  }

  loadCourses();
});