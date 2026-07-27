const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/product/:productId', authenticate, authorize('buyer'), ctrl.getForProduct);
router.post('/', authenticate, authorize('buyer'), ctrl.pay);
router.get('/:id/receipt', authenticate, authorize('buyer'), ctrl.receipt);

module.exports = router;
