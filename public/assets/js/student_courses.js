import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('jwt');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  try {
    const res = await fetch('/api/students/courses', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) return window.location.href = '/login.html';
    const { courses } = await res.json();

    const grid = document.getElementById('coursesGrid');
    grid.innerHTML = courses.map(c => `
  <div class="card">
    ${c.thumbnail
        ? `<img src="${c.thumbnail}" alt="${c.title} thumbnail" class="card-thumb" />`
        : `<div class="card-thumb"></div>`
      }
    <div class="card-content">
      <h2>${c.title}</h2>
      <p>By ${c.tutorName}</p>
    </div>
    <div class="card-actions">
      <button data-id="${c.id}" class="btn-view">View Course</button>
    </div>
  </div>
`).join('');

    grid.querySelectorAll('.btn-view').forEach(btn => {
      btn.onclick = () =>
        location.href = `/student_viewCourse.html?courseId=${btn.dataset.id}`;
    });
  } catch (err) {
    console.error(err);
    showToast('Failed to load courses');
  }
});