const express = require('express');
const prisma = require('../lib/prisma');
const { asyncRoute } = require('../lib/async-route');

const router = express.Router();

router.get('/', asyncRoute(async (req, res) => {
  const activities = await prisma.activity.findMany({
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ success: true, activities });
}));

module.exports = router;
