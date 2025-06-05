import { showToast } from './toast.js';

; (async function () {
  // 0) Sidebar elements
  const sidebar = document.getElementById('sidebar');
  const openBtn = document.getElementById('menu-bars');
  const closeBtn = document.getElementById('close-icon');
  const toggles = document.querySelector('.toggles');
  const content = document.querySelector('.content');

  // 1) Load & validate JWT
  const token = localStorage.getItem('jwt');
  if (!token) return window.location.href = '/login.html';

  // 2) Fetch current user
  let user;
  try {
    const res = await fetch('/api/user/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Unauthorized');
    ({ user } = await res.json());
  } catch (err) {
    localStorage.removeItem('jwt');
    return window.location.href = '/login.html';
  }

  // 3) Fill in profile
  document.getElementById('sidebarName').textContent = user.name;
  document.getElementById('sidebarRole').textContent =
    user.role.charAt(0).toUpperCase() + user.role.slice(1);

  // 4) Dynamic nav config by role
  const navConfig = {
    student: [
      { name: 'Home', href: '/student.html' },
      { name: 'Courses', href: '/student_courses.html' },
      { name: 'Tutors', href: '/student_tutors.html' },
      { name: 'Sessions', href: '/student_sessions.html' },
      { name: 'Settings', href: '/settings.html' },
    ],
    tutor: [
      { name: 'Home', href: '/tutor.html' },
      { name: 'My Courses', href: '/tutor_courses.html' },
      { name: 'Requests', href: '/tutor_requests.html' },
      { name: 'Sessions', href: '/tutor_sessions.html' },
      { name: 'Settings', href: '/settings.html' },
    ],
    admin: [
      { name: 'Dashboard', href: '/admin.html' },
      { name: 'Tutor Apps', href: '/admin_tutorRequests.html' },
      { name: 'Users', href: '/admin_users.html' },
      { name: 'Courses', href: '/admin_courses.html' },
      { name: 'Sessions', href: '/admin_sessions.html' },
      { name: 'Settings', href: '/settings.html' },
    ],
  };

  // 5) Render nav links
  const sidebarNav = document.getElementById('sidebarNav');
  sidebarNav.innerHTML = '';
  navConfig[user.role].forEach(item => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = item.href;
    a.textContent = item.name;
    li.appendChild(a);
    sidebarNav.appendChild(li);
  });

  // 6) Sidebar open/close
  openBtn.addEventListener('click', () => {
    sidebar.classList.add('active');
    toggles.style.transform = 'translateX(260px)';
    if (content) content.style.marginLeft = '260px';
  });
  closeBtn.addEventListener('click', () => {
    sidebar.classList.remove('active');
    toggles.style.transform = '';
    if (content) content.style.marginLeft = '';
  });

  // 7) Highlight active link
  const links = document.querySelectorAll('#sidebarNav a');
  const path = window.location.pathname;

  links.forEach(link => {
    const href = link.getAttribute('href');

    let isActive = (path === href);

    if (!isActive) {
      if (
        href === '/admin_courses.html' &&
        (path.startsWith('/admin_courseForm.html') ||
          path.startsWith('/admin_courseForm.html?'))
      ) {
        isActive = true;
      }
    }

    if (!isActive && href === '/admin_courses.html') {
      if (
        path.startsWith('/admin_content.html') ||
        path.startsWith('/admin_content.html?')
      ) {
        isActive = true;
      }
    }

    if (
      !isActive &&
      href === '/student_courses.html' &&
      path.startsWith('/student_viewCourse.html')
    ) {
      isActive = true;
    }


    if (!isActive) {
      if (
        href === '/tutor_courses.html' &&
        (path.startsWith('/tutor_courseForm.html') || path.startsWith('/tutor_courseForm.html?'))
      ) {
        isActive = true;
      }
    }


    if (!isActive) {
      if (
        href === '/student_tutors.html' &&
        (path.startsWith('/request_session.html'))
      ) {
        isActive = true;
      }
    }

  if (isActive) {
    link.classList.add('active');
  }
});




// 8) Logout
const logoutBtn = document.getElementById('logoutBtn');
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('jwt');
  window.location.href = '/index.html';
});
}) ();