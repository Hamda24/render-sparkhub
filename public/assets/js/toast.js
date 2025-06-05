export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // 1) build the toast
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  // 2) append and show
  container.append(toast);
  // kick off the CSS transition
  requestAnimationFrame(() => toast.classList.add('show'));

  // 3) auto-dismiss
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
}