import { showToast } from './toast.js';

(async function () {
  // 1) Grab the token
  const token = localStorage.getItem('jwt');
  console.log('🔑 stored JWT =', token);

  // 2) If missing → back to login
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  let user;
  try {
    // 3) Fetch the current user’s profile
    const res = await fetch('/api/user/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Unauthorized');
    ({ user } = await res.json());
  } catch (err) {
    console.error('Failed to fetch profile:', err);
    // clear any invalid token and redirect
    localStorage.removeItem('jwt');
    window.location.href = '/login.html';
    return;
  }

  // now it's safe to touch the DOM with user data
  const sidebarNameEl = document.getElementById('sidebarName');
  const sidebarRoleEl = document.getElementById('sidebarRole');
  const greetingEl = document.getElementById('greetingName');

  if (sidebarNameEl) sidebarNameEl.textContent = user.name;
  if (sidebarRoleEl)
    sidebarRoleEl.textContent =
      user.role.charAt(0).toUpperCase() + user.role.slice(1);
  if (greetingEl) greetingEl.textContent = user.name;

  // STUDENT
  if (user.role === 'student') {
    // 1) Grab references to the three stat elements in the DOM:
    const enrolledEl = document.getElementById('enrolledCount');
    const completedEl = document.getElementById('completedCount');
    const progressEl = document.getElementById('progressCount');

    // 2) A tiny helper to wrap fetch calls with the Authorization header:
    async function apiGet(path) {
      const res = await fetch(path, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        // Token invalid or expired → send them back to login
        window.location.href = '/login.html';
        return null;
      }
      if (!res.ok) {
        throw new Error(`API error ${res.status}`);
      }
      return res.json();
    }

    // 3) Now: fetch only the courses the student has “started”
    (async () => {
      try {
        // 3a) Fetch all courses the student is enrolled in:
        //     GET /api/students/courses → { courses: [ { id, title, … }, … ] }
        const coursesData = await apiGet('/api/students/courses');
        if (!coursesData || !coursesData.courses) {
          throw new Error('Could not load enrolled courses.');
        }
        const allCourses = coursesData.courses;

        // 3b) We will compute three counters:
        //     startedCount   = number of courses where hasStarted===true
        //     completedCount = number of courses where doneCount === totalItems
        //     inProgressCount= number of courses where 0 < doneCount < totalItems
        let startedCount = 0;
        let completedCount = 0;
        let inProgressCount = 0;

        // 3c) For each course, we must check:
        //     1) /courses/:id/hasStarted → { hasStarted: true/false }
        //     2) /courses/:id/content    → { videos:[…], pdfs:[…], quizzes:[…] }
        //     3) /courses/:id/progress   → { completed: [ "video:24", … ] }
        await Promise.all(
          allCourses.map(async (course) => {
            const courseId = course.id;

            // 3c-1) Has the student clicked “Start Course” at least once?
            const startedData = await apiGet(`/api/students/courses/${courseId}/hasStarted`);
            if (!startedData) return;               // abort if API error or 401
            if (!startedData.hasStarted) {
              // If they never clicked “Start,” skip this course entirely
              return;
            }
            // Otherwise, they have “started” this course:
            startedCount += 1;

            // 3c-2) Fetch the course’s content so we know how many total items exist
            const contentData = await apiGet(`/api/students/courses/${courseId}/content`);
            if (!contentData) return;
            const totalItems =
              (contentData.videos || []).length +
              (contentData.pdfs || []).length +
              (contentData.quizzes || []).length;

            // 3c-3) Fetch this student’s progress within that course
            //         (the “__started__” dummy is already filtered out)
            const progressData = await apiGet(`/api/students/courses/${courseId}/progress`);
            if (!progressData) return;
            const doneCount = (progressData.completed || []).length;

            // 3c-4) Decide “in progress” vs “completed”:
            if (doneCount === 0) {
              // They clicked “Start” but haven’t marked any item done → do not count as "In Progress" or "Completed"
            } else if (doneCount < totalItems) {
              // Partially done → In Progress
              inProgressCount += 1;
            } else {
              // doneCount === totalItems → Completed
              completedCount += 1;
            }
          })
        );

        // 4) Finally, write those three numbers back into the DOM:
        if (enrolledEl) enrolledEl.textContent = String(startedCount);
        if (completedEl) completedEl.textContent = String(completedCount);
        if (progressEl) progressEl.textContent = String(inProgressCount);
      }
      catch (err) {
        console.error('Error loading student dashboard stats:', err);
        showToast('Could not load your dashboard statistics.', 'error');
        // On any failure, show “–” in each box
        if (enrolledEl) enrolledEl.textContent = '–';
        if (completedEl) completedEl.textContent = '–';
        if (progressEl) progressEl.textContent = '–';
      }
    })();
  }


  // TUTOR
  if (user.role === 'tutor') {
    // If status is “pending” or “rejected”, replace stats area with a message
    if (user.status === 'pending') {
      document.querySelector('.stats').innerHTML = `
        <p>Your application is <strong>pending</strong>.<br>
           You will be notified once the admin reviews your profile.</p>`;
      return;
    }
    if (user.status === 'rejected') {
      document.querySelector('.stats').innerHTML = `
        <p>We’re sorry — your tutor application was <strong>rejected</strong>.<br>
           Please contact support if you’d like to reapply.</p>`;
      return;
    }
    // Otherwise, fetch three numbers: “Courses Created” and “Active Students”
    const tutorId = user.id;
    // ─── (A) Fetch “Courses Created” ─────────────────────────────────
    (async () => {
      try {
        const coursesRes = await fetch(`/api/tutors/${tutorId}/courses`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!coursesRes.ok) throw new Error('Could not load courses');
        const coursesData = await coursesRes.json();
        const coursesCount = Array.isArray(coursesData.courses)
          ? coursesData.courses.length
          : 0;
        const el = document.getElementById('tutorCoursesCount');
        if (el) el.textContent = String(coursesCount);
      } catch (err) {
        console.error('Error loading courses‐created:', err);
        const el = document.getElementById('tutorCoursesCount');
        if (el) el.textContent = '–';
        showToast('Unable to load your course count.', 'error');
      }
    })();
    // ─── (B) Fetch “Active Students” ─────────────────────────────────
    (async () => {
      try {
        const studentsRes = await fetch(`/api/tutors/${tutorId}/active-students`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!studentsRes.ok) throw new Error('Could not load active students');
        const studentsData = await studentsRes.json();
        // Expecting: { "activeStudentCount": <number> }
        const count = typeof studentsData.activeStudentCount === 'number'
          ? studentsData.activeStudentCount
          : 0;
        const el = document.getElementById('tutorActiveStudentsCount');
        if (el) el.textContent = String(count);
      } catch (err) {
        console.error('Error loading active students:', err);
        const el = document.getElementById('tutorActiveStudentsCount');
        if (el) el.textContent = '–';
        showToast('Unable to load active student count.', 'error');
      }
    })();
    // ─── (C) Fetch “Pending Quizzes” (COMMENTED OUT) ─────────────────
    /*
    (async () => {
      try {
        const quizRes = await fetch(`/api/tutors/${tutorId}/pending-quizzes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!quizRes.ok) throw new Error('Could not load pending quizzes');
        const quizData = await quizRes.json();
        const count = typeof quizData.pendingQuizzes === 'number'
          ? quizData.pendingQuizzes
          : 0;
        const el = document.getElementById('tutorPendingQuizzesCount');
        if (el) el.textContent = String(count);
      } catch (err) {
        console.error('Error loading pending quizzes:', err);
        const el = document.getElementById('tutorPendingQuizzesCount');
        if (el) el.textContent = '–';
        showToast('Unable to load pending quizzes.', 'error');
      }
    })();
    */
    return; // Done with tutor branch
  }


  // ADMIN
  if (user.role === 'admin') {
    // ─── (1) Load “Tutor Applications” ───────────────────────────────
    const requestsTbody = document.querySelector('#requestsTable tbody');
    if (requestsTbody) {
      try {
        const reqRes = await fetch('/api/admin/tutors/requests', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!reqRes.ok) throw new Error('Failed to fetch tutor requests');
        const { apps } = await reqRes.json();
        apps.forEach(a => {
          let dateHtml = '';
          let actionHtml = '';

          if (a.status === 'pending') {
            dateHtml = `<input type="datetime-local" id="dt-${a.id}">`;
            actionHtml = `<button onclick="decide(${a.id}, 'schedule')">✅ Schedule</button>`;
          } else if (a.status === 'scheduled') {
            dateHtml = new Date(a.interview_date).toLocaleString();
            actionHtml = `
              <button onclick="approveTutor(${a.id})">✅ Approve Tutor</button>
              <button onclick="rejectTutor(${a.id})">❌ Reject Tutor</button>
            `;
          }

          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${a.name}</td>
            <td>${a.email}</td>
            <td>${new Date(a.created_at).toLocaleDateString()}</td>
            <td>${dateHtml}</td>
            <td>${actionHtml}</td>
          `;
          requestsTbody.append(row);
        });
      } catch (err) {
        console.error('Error loading tutor applications:', err);
        showToast('Unable to load tutor applications.', 'error');
      }
    }

    // ─── (2) Fetch “Total Users” ───────────────────────────────────────
    const totalUsersEl = document.getElementById('totalUsersCount');
    if (totalUsersEl) {
      try {
        const usersRes = await fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!usersRes.ok) throw new Error(`HTTP ${usersRes.status}`);
        const usersData = await usersRes.json();
        totalUsersEl.textContent = Array.isArray(usersData.users)
          ? usersData.users.length
          : '0';
      } catch (err) {
        console.error('Error loading total users:', err);
        totalUsersEl.textContent = '–';
        showToast('Unable to load total users.', 'error');
      }
    }

    // ─── (3) Fetch “Total Courses” ─────────────────────────────────────
    const totalCoursesEl = document.getElementById('totalCoursesCount');
    if (totalCoursesEl) {
      try {
        const coursesRes = await fetch('/api/admin/courses', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!coursesRes.ok) throw new Error(`HTTP ${coursesRes.status}`);
        const coursesData = await coursesRes.json();
        totalCoursesEl.textContent = Array.isArray(coursesData.courses)
          ? coursesData.courses.length
          : '0';
      } catch (err) {
        console.error('Error loading total courses:', err);
        totalCoursesEl.textContent = '–';
        showToast('Unable to load total courses.', 'error');
      }
    }

    // end of admin branch
    return;
  }

}) ();

  async function decide(id, action) {
    const token = localStorage.getItem('jwt');

    if (action === 'schedule') {
      // 1) grab & validate the date
      const interviewDate = document.getElementById(`dt-${id}`).value;
      if (!interviewDate) {
        return showToast('Please select a date & time first.');
      }

      // 2) try to schedule
      const res = await fetch(`/api/admin/tutors/${id}/schedule`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ interviewDate })
      });

      // 3) handle a double-book (409)
      if (res.status === 409) {
        const { error } = await res.json();
        return showToast(error);
      }

      // 4) handle any other error
      if (!res.ok) {
        const { error, message } = await res.json();
        return showToast(error || message);
      }

      // 5) success! refresh the page
      return window.location.reload();
    }

    if (action === 'reject') {
      // outright reject
      const res = await fetch(`/api/admin/tutors/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) {
        const { error, message } = await res.json();
        return showToast(error || message);
      }
      return window.location.reload();
    }
  }

  async function approveTutor(id) {
    const token = localStorage.getItem('jwt');
    // 1) capture the response
    const res = await fetch(`/api/admin/tutors/${id}/approve`, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const json = await res.json();
    if (!res.ok) {
      // show an error (you can swap out showToast for your flash)
      return showToast('Error approving tutor:\n' + (json.error || json.message));
    }
    // 2) reload the page so the row disappears
    window.location.reload();
  }

  // Reject (either before or after the meeting)
  async function rejectTutor(id) {
    const token = localStorage.getItem('jwt');
    const res = await fetch(`/api/admin/tutors/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const json = await res.json();
    if (!res.ok) {
      return showToast('Error rejecting tutor:\n' + (json.error || json.message));
    }
    window.location.reload();
  }

  window.decide = decide;
  window.approveTutor = approveTutor;
  window.rejectTutor = rejectTutor;