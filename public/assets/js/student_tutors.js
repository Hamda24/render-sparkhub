import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('jwt');
  if (!token) {
    return window.location.href = '/login.html';
  }

  try {
    const res = await fetch('/api/sessions/tutors', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load tutors');
    const { tutors } = await res.json();

    const grid = document.getElementById('tutorGrid');
    grid.innerHTML = ''; // clear any placeholder

    tutors.forEach(t => {
      // Only show specialty if it's non-null/non-empty
      const specialtyHtml = t.specialty
        ? `<p>${t.specialty}</p>`
        : '';

      const card = document.createElement('div');
      card.className = 'tutor-card';
      card.innerHTML = `
        <h3>${t.name}</h3>
        ${specialtyHtml}
        <button data-id="${t.id}">Request Session</button>
      `;
      card.querySelector('button').addEventListener('click', () => {
        window.location.href = `/request_session.html?tutor=${t.id}`;
      });
      grid.appendChild(card);
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
});