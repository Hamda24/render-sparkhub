import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('jwt');
  if (!token) {
    return window.location.href = '/login.html';
  }

  // load tutor info
  const params = new URLSearchParams(window.location.search);
  const tutorId = params.get('tutor');
  if (!tutorId) {
    showToast('No tutor specified', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/sessions/tutors/${tutorId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Tutor not found');
    const { tutor } = await res.json();
    document.getElementById('tutorPic').src = tutor.profile_pic_url;
    document.getElementById('tutorName').textContent = tutor.name;
    document.getElementById('tutorSpecialty').textContent = tutor.specialty;
  } catch (err) {
    return showToast(err.message, 'error');
  }

  // handle form
  document.getElementById('sessionForm').addEventListener('submit', async e => {
    e.preventDefault();
    const preferredAt = e.target.preferredAt.value;
    const note        = e.target.note.value;

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify({ tutorId, preferredAt, note })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      showToast('Session request sent!', 'success');
      setTimeout(() => window.location.href = '/student_sessions.html', 800);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
});