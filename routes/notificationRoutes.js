const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notificationController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, ctrl.list);
router.get('/unread-count', authenticate, ctrl.unreadCount);
router.post('/:id/read', authenticate, ctrl.markRead);
router.post('/read-all', authenticate, ctrl.markAllRead);
router.delete('/:id', authenticate, ctrl.remove);
router.delete('/', authenticate, ctrl.clear);

module.exports = router;
