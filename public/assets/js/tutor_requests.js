import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('jwt');
  if (!token) return window.location.href = 'login.html';

  try {
    const res = await fetch('/api/sessions/tutor', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Could not load requests');
    const { sessions } = await res.json();

    const tbody = document.querySelector('#requestsTable tbody');
    sessions
      .filter(s => s.status === 'pending')
      .forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${s.studentName}</td>
          <td>${new Date(s.preferredAt).toLocaleString()}</td>
          <td>${s.status.charAt(0).toUpperCase() + s.status.slice(1)}</td>
          <td>
            <input type="datetime-local" id="dt-${s.id}" />
            <button data-id="${s.id}" class="approve">✅</button>
            <button data-id="${s.id}" class="decline">❌</button>
          </td>
        `;
        tbody.append(tr);
      });

    // approve
    tbody.addEventListener('click', async e => {
      if (!e.target.matches('button.approve')) return;
      const id = e.target.dataset.id;
      const dt = document.getElementById(`dt-${id}`).value;
      if (!dt) return showToast('Select a date/time first', 'error');

      const res2 = await fetch(`/api/sessions/${id}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify({ scheduledAt: dt })
      });
      if (!res2.ok) {
        const j = await res2.json();
        return showToast(j.error || 'Approve failed', 'error');
      }
      showToast('Request approved', 'success');
      setTimeout(() => location.reload(), 500);
    });

    // decline
    tbody.addEventListener('click', async e => {
      if (!e.target.matches('button.decline')) return;
      const id = e.target.dataset.id;
      const res2 = await fetch(`/api/sessions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res2.ok) {
        const j = await res2.json();
        return showToast(j.error || 'Decline failed', 'error');
      }
      showToast('Request declined', 'info');
      setTimeout(() => location.reload(), 500);
    });

  } catch (err) {
    showToast(err.message, 'error');
  }
});