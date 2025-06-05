import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  const token        = localStorage.getItem('jwt');
  const modeBtn      = document.getElementById('modeToggleBtn');
  const emailBtn     = document.getElementById('emailBtn');
  const passwordBtn  = document.getElementById('passwordBtn');
  const settingsCard = document.getElementById('settingsCard');
  const emailForm    = document.getElementById('emailForm');
  const passForm     = document.getElementById('passwordForm');

  function hideAll() {
    settingsCard.classList.add('hidden');
    emailForm  .classList.add('hidden');
    passForm   .classList.add('hidden');
    emailBtn   .classList.remove('active');
    passwordBtn.classList.remove('active');
  }

  // 1) Appearance: just toggle theme & keep card hidden
  modeBtn.addEventListener('click', () => {
    hideAll();
    const isDark = document.documentElement.classList.toggle('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });

  // 2) Show email form
  emailBtn.addEventListener('click', () => {
    hideAll();
    emailBtn.classList.add('active');
    settingsCard.classList.remove('hidden');
    emailForm  .classList.remove('hidden');
  });

  // 3) Show password form
  passwordBtn.addEventListener('click', () => {
    hideAll();
    passwordBtn.classList.add('active');
    settingsCard.classList.remove('hidden');
    passForm   .classList.remove('hidden');
  });

  // 4) Email submission
  emailForm.addEventListener('submit', async e => {
    e.preventDefault();
    const oldEmail = e.target.oldEmail.value.trim();
    const newEmail = e.target.newEmail.value.trim();

    if (oldEmail === newEmail) {
      return showToast('New email must differ from current', 'error');
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ oldEmail, newEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update email');
      showToast('Email updated successfully!', 'success');
      e.target.reset();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 5) Password submission
  passForm.addEventListener('submit', async e => {
    e.preventDefault();
    const oldPassword = e.target.oldPassword.value;
    const newPassword = e.target.newPassword.value;
    const confirm     = document.getElementById('confirmPassword').value;

    if (newPassword !== confirm) {
      return showToast('Passwords do not match', 'error');
    }
    if (newPassword === oldPassword) {
      return showToast('New password must differ from current', 'error');
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      showToast('Password updated successfully!', 'success');
      e.target.reset();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // startup
  hideAll();
});