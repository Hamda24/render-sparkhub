document.addEventListener('DOMContentLoaded', () => {
  const html = document.documentElement;
  if (localStorage.getItem('theme') === 'dark') {
    html.classList.add('dark-theme');
  }
  const toggle = document.getElementById('modeToggle');
  if (!toggle) return;
  toggle.checked = html.classList.contains('dark-theme');
  toggle.addEventListener('change', () => {
    const dark = toggle.checked;
    html.classList.toggle('dark-theme', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  });
});