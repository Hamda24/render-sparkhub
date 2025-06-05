document.addEventListener('DOMContentLoaded', () => {
  const tableBody  = document.getElementById('usersTable');
  const roleFilter = document.getElementById('roleFilter');
  const jwt        = localStorage.getItem('jwt');

  async function loadUsers() {
    const role = roleFilter.value;
    const url  = `/api/admin/users${role ? `?role=${role}` : ''}`;
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + jwt }
      });
      if (!res.ok) throw new Error('Failed to load users');
      const { users } = await res.json();
      tableBody.innerHTML = users.map(u => `
        <tr>
          <td>${u.name}</td>
          <td>${u.email}</td>
          <td>${u.role.charAt(0).toUpperCase() + u.role.slice(1)}</td>
          <td>${new Date(u.created_at).toLocaleDateString()}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error(err);
      tableBody.innerHTML = `
        <tr><td colspan="4" class="error">
          Unable to retrieve users. Please try again later.
        </td></tr>`;
    }
  }

  roleFilter.addEventListener('change', loadUsers);
  loadUsers();
});