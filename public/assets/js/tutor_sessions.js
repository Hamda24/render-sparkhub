import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('jwt');
  if (!token) return window.location.href = 'login.html';

  try {
    const res = await fetch('/api/sessions/tutor', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Could not load sessions');
    const { sessions } = await res.json();

    const tbody = document.querySelector('#sessionsTable tbody');
    sessions
      .filter(s => s.status === 'approved' || s.status === 'scheduled')
      .forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${s.studentName}</td>
          <td>${new Date(s.scheduledAt).toLocaleString()}</td>
           <td>
            ${s.meetLink
            ? `<a href="${s.meetLink}" target="_blank">Join</a>`
            : '—'}
      </td>
          <td>
            <button data-id="${s.id}" class="cancel">Cancel</button>
          </td>
        `;
        tbody.append(tr);
      });

    tbody.addEventListener('click', async e => {
      if (!e.target.matches('button.cancel')) return;
      const id = e.target.dataset.id;
      const res2 = await fetch(`/api/sessions/${id}/cancel`, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res2.ok) {
        const j = await res2.json();
        return showToast(j.error || 'Cancel failed', 'error');
      }
      showToast('Session cancelled', 'info');
      setTimeout(() => location.reload(), 500);
    });

  } catch (err) {
    showToast(err.message, 'error');
  }
});