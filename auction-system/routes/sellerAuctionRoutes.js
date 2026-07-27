const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sellerAuctionController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate, authorize('seller'));
router.get('/', ctrl.list);
router.get('/recent-alerts', ctrl.recentAlerts);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/close', ctrl.close);
module.exports = router;
