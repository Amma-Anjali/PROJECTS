const express = require('express');
const { body } = require('express-validator');
const { protect, adminOnly } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const orderController = require('../controllers/orderController');

const router = express.Router();

router.get('/config', orderController.getConfig);

router.post(
  '/checkout',
  protect,
  [
    body('deliveryAddress.line1').trim().notEmpty().withMessage('Address line is required'),
    body('deliveryAddress.city').trim().notEmpty().withMessage('City is required'),
  ],
  handleValidation,
  orderController.checkout
);

router.post('/:id/confirm-payment', protect, orderController.confirmPayment);
router.get('/', protect, orderController.listMine);
router.get('/admin/all', protect, adminOnly, orderController.listAll);
router.get('/:id', protect, orderController.getOne);
router.put('/:id/status', protect, adminOnly, orderController.updateStatus);
router.get('/:id/invoice', protect, orderController.getInvoice);

module.exports = router;
