const express = require('express');
const authRoutes = require('./auth.routes');
const ordersRoutes = require('./orders.routes');
const clientsRoutes = require('./clients.routes');
const tasksRoutes = require('./tasks.routes');
const financesRoutes = require('./finances.routes');
const dashboardRoutes = require('./dashboard.routes');
const activityRoutes = require('./activity.routes');
const { requireAuth, requireOwner, requireCsrf } = require('../middleware/auth');

const router = express.Router();

router.use('/auth', authRoutes);
router.use(requireAuth, requireOwner, requireCsrf);
router.use('/dashboard', dashboardRoutes);
router.use('/orders', ordersRoutes);
router.use('/clients', clientsRoutes);
router.use('/tasks', tasksRoutes);
router.use('/finances', financesRoutes);
router.use('/activity', activityRoutes);

module.exports = router;
