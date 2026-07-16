const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.post('/', authenticate, authorize('seller'), productController.createProduct);
router.patch('/:id/approve', authenticate, authorize('admin'), productController.approveProduct);

module.exports = router;
