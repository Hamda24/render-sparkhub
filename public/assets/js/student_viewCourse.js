import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('jwt');
  const courseId = new URLSearchParams(location.search).get('courseId');

  if (!token) {
    window.location.href = '/login.html';
    return;
  }
  if (!courseId) {
    showToast('Missing courseId in URL', 'error');
    return;
  }

  // ─── State ───────────────────────────────────────────────
  let allItems = [];           // “real” items (videos + pdfs + quizzes)
  let completed = new Set();    // holds strings like "video:123", "pdf:42", etc.
  let hasStarted = false;        // becomes true as soon as Start Course or a real item was done

  // Get references to DOM nodes we’ll need:
  const startContainer = document.getElementById('startContainer');
  const startBtn = document.getElementById('startCourseBtn');
  const progressDiv = document.getElementById('progressGraph');
  const container = document.getElementById('itemsContainer');
  const titleH1 = document.getElementById('courseTitle');

  // ─── (A) “Start Course” Button Logic ───────────────────────
  function initStartButton() {
    startBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(
          `/api/students/courses/${courseId}/start`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        if (!res.ok) {
          throw new Error(`Failed to start course (status ${res.status})`);
        }

        // As soon as server returns 204, that means the student has clicked “Start Course.”
        hasStarted = true;
        startContainer.style.display = 'none'; // hide the button

        // Re-fetch content + progress so the UI updates cleanly:
        await loadCourseContent();
      } catch (err) {
        console.error('❌ Error starting course:', err);
        showToast('Could not start the course.');
      }
    });
  }

  // ─── (B) Fetch Content + Progress ──────────────────────────
  async function loadCourseContent() {
    try {
      // 1) fetch course‐content metadata…
      const contentRes = await fetch(
        `/api/students/courses/${courseId}/content`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (contentRes.status === 401) {
        window.location.href = '/login.html';
        return;
      }
      if (!contentRes.ok) {
        throw new Error('Failed to fetch course content');
      }
      const { courseTitle: ct, videos, pdfs } = await contentRes.json();
      titleH1.textContent = ct;

      // 2) Build unified allItems array (only “real” items)
      allItems = [
        ...videos.map(v => ({
          type: 'video',
          id: v.id,
          title: v.title,
          rawUrl: `/api/students/content/${v.id}/raw`
        })),
        ...pdfs.map(p => ({
          type: 'pdf',
          id: p.id,
          title: p.title,
          rawUrl: `/api/students/content/${p.id}/raw`

        }))
      ];

      // 3) Fetch this student’s existing progress rows
      //    (the dummy “__started__:0” is already excluded by getCompleted’s SQL)
      const progRes = await fetch(
        `/api/students/courses/${courseId}/progress`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!progRes.ok) throw new Error('Failed to load progress');

      // 3a) Read the JSON (compArr is an array like ["video:24","__started__:0","pdf:16"] or [])
      const { completed: compArr } = await progRes.json();

      // 3b) Filter out any "__started__:0" entries just in case
      const realCompArr = compArr.filter(key => !key.startsWith('__started__:'));

      // 3c) Build your Set of completed real‐item keys
      completed = new Set(realCompArr);

      // 3d) Decide whether Start‐Course should still be visible:
      //     • If they have at least one real completed item, “hasStarted” = true.
      //     • Otherwise, if we ourselves just clicked “Start Course” (hasStarted===true), that also counts.
      if (completed.size > 0 || hasStarted) {
        hasStarted = true;
        startContainer.style.display = 'none';
      } else {
        hasStarted = false;
        startContainer.style.display = 'block';
      }

      // 4) Render the cards (which will read `completed.size` to draw the circle correctly)
      renderItems('all');
    }
    catch (err) {
      console.error('Error loading course content:', err);
      showToast('Failed to load course content.');
    }
  }

  // ─── (C) Render + Bind Buttons ─────────────────────────────
  function renderItems(filter) {
    // 1) Filter items by the chosen pill (“all”, “videos”, “pdfs”, or “quizzes”)
    const filtered = allItems.filter(item => {
      if (filter === 'all') return true;
      return filter === `${item.type}s`; // e.g. “videos” → item.type === “video”
    });

    if (filtered.length === 0) {
      container.innerHTML = `<p class="no-content">No content available.</p>`;
      // If there are no real items at all, immediately redraw the circle at 0%.
      renderProgressGraph(0, 0);
      return;
    }

    // 2) Build each card’s HTML
    container.innerHTML = filtered
      .map(item => {
        const key = `${item.type}:${item.id}`;       // e.g. "video:24"
        const isDone = completed.has(key);               // did they mark this real item as done?

        // Disable ALL buttons (View/Download/Mark Done) until the course is started.
        // Once the course is started, “View”/“Download” become enabled, but “Mark Done”
        // remains disabled if that item is already done.
        const disableAll = !hasStarted ? 'disabled' : '';
        const disableMarkDone = (!hasStarted || isDone) ? 'disabled' : '';

        const iconClass = (item.type === 'video')
          ? 'icon-video'
          : (item.type === 'pdf')
            ? 'icon-pdf'
            : '';

        return `
        <div class="content-card ${isDone ? 'done' : ''}"
             data-key="${key}"
             data-type="${item.type}"
             data-rawurl="${item.rawUrl || ''}">
          <div class="content-card-body">
            <i class="content-icon ${iconClass}"></i>
            <h3>${item.title}</h3>
            <div class="content-type">(${item.type})</div>
          </div>

          <div class="media-wrapper"></div>

          <div class="content-card-actions">
            <!-- VIEW -->
            <button class="btn-preview"
                    title="View"
                    ${disableAll}
                    data-rawurl="${item.rawUrl}?token=${token} || ''}">
              <i class="fas fa-eye"></i>
            </button>

            <!-- DOWNLOAD -->
            <button class="btn-download"
                    title="Download"
                    ${disableAll}
                    data-rawurl="${item.rawUrl}?token=${token}|| ''}">
              <i class="fas fa-download"></i>
            </button>

            <!-- MARK DONE -->
            <button class="btn-done"
                    title="${isDone ? 'Completed' : 'Mark Done'}"
                    ${disableMarkDone}>
              <i class="fas fa-check"></i>
              ${(hasStarted && isDone) ? 'Completed' : ''}
            </button>
          </div>
        </div>`;
      })
      .join('');

    // ── (C.1) “View” button handler ────────────────────────────
    container.querySelectorAll('.btn-preview').forEach(btn => {
     btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      const rawUrl = btn.dataset.rawurl;
      if (!rawUrl) return;
      try {
        const res = await fetch(rawUrl, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        window.addEventListener('unload', () => URL.revokeObjectURL(url));
      } catch {
        showToast('Failed to load preview.');
      }
    });
    });

    // DOWNLOAD
    container.querySelectorAll('.btn-download').forEach(btn => {
 btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      const rawUrl = btn.dataset.rawurl;
      if (!rawUrl) return;

      try {
        const res = await fetch(rawUrl, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // pick file extension from content-type
        const contentType = res.headers.get('Content-Type') || '';
        const ext = contentType.includes('pdf') ? '.pdf' : '.mp4';
        a.download =
          btn.closest('.content-card')
             .querySelector('h3').innerText + ext;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        showToast('Failed to download.');
      }
    });
    });

    // ── (C.3) “Mark Done” button handler ───────────────────────
    container.querySelectorAll('.btn-done').forEach(btn => {
      btn.addEventListener('click', async e => {
        // If disabled, and the reason is “course not started,” show a toast.
        if (btn.disabled && !hasStarted) {
          showToast('Please click “Start Course” before marking items as done.', 'error');
          return;
        }
        if (btn.disabled) return;   // already completed

        const card = e.target.closest('.content-card');
        const [type, id] = card.dataset.key.split(':');

        try {
          // (We know hasStarted is now true if we’re here.)
          const res = await fetch(
            `/api/students/courses/${courseId}/progress`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ itemType: type, itemId: +id })
            }
          );
          if (!res.ok) throw new Error('Mark-done failed');

          // Update local state & UI:
          completed.add(`${type}:${id}`);
          card.classList.add('done');
          btn.innerHTML = `<i class="fas fa-check"></i> Completed`;
          btn.disabled = true;

          // Update the progress circle:
          const totalCount = allItems.length;
          const doneCount = completed.size;
          updateProgressGraph(doneCount, totalCount);
        } catch (err) {
          console.error(err);
          showToast('Failed to mark as done.');
        }
      });
    });

    // ── (C.4) When all cards have been inserted, draw the circle at the correct percentage:
    const totalCount = allItems.length;
    const doneCount = completed.size;
    renderProgressGraph(doneCount, totalCount);
  }

  // ─── (D) Build & Update the Circular Progress Graph ─────────
  //
  // In your HTML, make sure you have:
  //   <div id="progressGraph"></div>
  //
  // This function simply draws a gray circle plus a colored arc of “pct” percent.
  function renderProgressGraph(doneCount, totalCount) {
    // If there are no “real” items at all, show the ring at 0 % and bail:
    if (totalCount === 0) {
      progressDiv.innerHTML = `
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="55" stroke="#e6e6e6" stroke‐width="10" fill="none"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
                font-size="20" fill="#333">0%</text>
        </svg>
      `;
      return;
    }

    // Otherwise, compute the percentage of real items completed:
    const pct = Math.round((doneCount / totalCount) * 100);

    // Now draw the SVG:
    const size = 120;   // px
    const strokeWidth = 10;    // px
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - pct / 100);

    progressDiv.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <!-- Background ring (light gray) -->
        <circle
          cx="${size / 2}" cy="${size / 2}"
          r="${radius}"
          stroke="#e6e6e6"
          stroke-width="${strokeWidth}"
          fill="none"
        />
        <!-- Foreground arc (colored portion) -->
        <circle
          cx="${size / 2}" cy="${size / 2}"
          r="${radius}"
          stroke="#6a5acd"
          stroke-width="${strokeWidth}"
          fill="none"
          stroke-dasharray="${circumference} ${circumference}"
          stroke-dashoffset="${offset}"
          transform="rotate(-90 ${size / 2} ${size / 2})"
          style="transition: stroke-dashoffset 0.5s ease-out;"
        />
        <!-- Centered percentage text -->
        <text
          x="50%" y="50%"
          dominant-baseline="middle"
          text-anchor="middle"
          font-size="20"
          fill="#333"
        >${pct}%</text>
      </svg>
    `;
  }

  function updateProgressGraph(doneCount, totalCount) {
    renderProgressGraph(doneCount, totalCount);
  }

  // ─── (E) Wire up the Filter Pills (“All / Videos / PDFs / Quizzes”) ─────
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.filter-btn.active').classList.remove('active');
      btn.classList.add('active');
      renderItems(btn.dataset.filter);
    });
  });

  // ─── (F) Kick everything off ─────────────────────────────────
  initStartButton();
  loadCourseContent();
});