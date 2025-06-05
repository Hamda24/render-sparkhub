import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('jwt');
  if (!token) {
    return window.location.href = '/login.html';
  }

  try {
    const res = await fetch('/api/sessions/student', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load your sessions');
    const { sessions } = await res.json();

    const tbody = document.querySelector('#sessionsTable tbody');
    tbody.innerHTML = ''; // clear any old rows
    sessions.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.tutorName}</td>
        <td>${new Date(s.preferredAt).toLocaleString()}</td>
        <td>${s.scheduledAt
          ? new Date(s.scheduledAt).toLocaleString()
          : 'TBD'}</td>
        <td>
      ${s.meetLink
    ? `<a href="${s.meetLink}" target="_blank">Join</a>`
    : '—'}
    </td>
        <td>${s.status.charAt(0).toUpperCase() + s.status.slice(1)}</td>
        <td>${s.reply || '—'}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
});