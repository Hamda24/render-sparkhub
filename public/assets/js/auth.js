import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  // ————— LOGIN —————
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email    = loginForm.email.value;
      const password = loginForm.password.value;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Login failed');
        localStorage.setItem('jwt', data.token);
        switch (data.role) {
          case 'tutor':
            window.location.href = 'tutor.html'; break;
          case 'admin':
            window.location.href = 'admin.html'; break;
          default:
            window.location.href = 'student.html';
        }
      } catch (err) {
       showToast(err.message);
      }
    });
  }

  // ———— TUTOR-FIELDS TOGGLE ————
  const roleSelect  = document.getElementById('role');
  const tutorFields = document.getElementById('tutorFields');
  if (roleSelect && tutorFields) {
    const update = () => {
      tutorFields.style.display = roleSelect.value === 'tutor' ? 'block' : 'none';
    };
    roleSelect.addEventListener('change', update);
    update();
  }

  // ————— REGISTER —————
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();
      // basic password-match check
      const pwd     = registerForm.password.value;
      const confirm = registerForm.confirm.value;
      if (pwd !== confirm) {
        return showToast('Passwords do not match');
      }

      // build FormData (this picks up files + fields)
      const formData = new FormData(registerForm);

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          body: formData
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || json.message || 'Registration failed');
        showToast(json.message);
        window.location.href = 'login.html';
      } catch (err) {
        showToast(err.message);
      }
    });
  }
});