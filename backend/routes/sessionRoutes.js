    const express = require('express');
    const authMw = require('../middleware/authMiddleware');
    const router = express.Router();

    const {
    listTutors,
    getTutorById,
    createSessionRequest,
    listStudentSessions,
    listTutorSessions,
    approveSession,
    declineSession,
    cancelSessionByTutor,
    } = require('../controllers/sessionController');

    // 1. List all tutors (for student browse)
    router.get('/tutors', authMw(), listTutors);

    // 2. Get single tutor details
    router.get('/tutors/:id', authMw(), getTutorById);

    // 3. Student creates a session request
    router.post('/', authMw(), createSessionRequest);

    // 4. Student views their requests
    router.get('/student', authMw(), listStudentSessions);

    // 5. Tutor views incoming requests
    router.get('/tutor', authMw(), listTutorSessions);

    // 6. Tutor approves (schedules) a session
    router.put('/:id/approve', authMw(), approveSession);

    // 7. Tutor declines a request
    router.delete('/:id', authMw(), declineSession);

    // 8. Tutor cancels an approved session
    router.put('/:id/cancel', authMw(), cancelSessionByTutor);

    module.exports = router;