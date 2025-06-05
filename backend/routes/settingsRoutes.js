const express = require('express');
const router = express.Router();
const { updateCredentials } = require('../controllers/settingsController');
const authMw = require('../middleware/authMiddleware'); 

router.put('/', authMw(), updateCredentials);

module.exports = router;