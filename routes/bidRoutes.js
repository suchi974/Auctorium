const express = require('express');
const router = express.Router();
const bidController = require('../controllers/bidController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.post('/', authenticate, authorize('buyer'), bidController.placeBid);
router.get('/product/:productId', bidController.getBidsForProduct);
router.get('/my', authenticate, authorize('buyer'), bidController.myBids);

module.exports = router;
