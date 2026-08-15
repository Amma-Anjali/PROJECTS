const express = require('express');
const cultureController = require('../controllers/cultureController');

const router = express.Router();

router.get('/', cultureController.list);
router.get('/:name', cultureController.getOne);

module.exports = router;
