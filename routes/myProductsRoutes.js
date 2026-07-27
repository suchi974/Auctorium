const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/myProductsController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', authenticate, authorize('buyer'), ctrl.list);
router.get('/:id', authenticate, authorize('buyer'), ctrl.detail);

module.exports = router;
