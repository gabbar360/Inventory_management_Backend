const { Router } = require('express');
const { LeadController } = require('../controllers/leadController');
const { authenticateToken } = require('../middleware/auth');

const router = Router();

router.use(authenticateToken);

router.get('/getall-leads', LeadController.getAll);
router.post('/create-lead', LeadController.create);
router.get('/get-leads/:id', LeadController.getById);
router.put('/update-leads/:id', LeadController.update);
router.delete('/delete-leads/:id', LeadController.delete);

module.exports = router;
