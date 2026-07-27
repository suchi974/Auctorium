const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', categoryController.getAll);
router.post('/', authenticate, authorize('admin'), categoryController.create);

module.exports = router;
