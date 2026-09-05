const prisma = require('./prisma');

async function recordActivity({ req, action, entityType, entityId = null, title, metadata = null }) {
  try {
    await prisma.activity.create({
      data: {
        actorId: req?.user?.id || null,
        action,
        entityType,
        entityId,
        title: String(title).slice(0, 300),
        metadata: metadata ? JSON.stringify(metadata).slice(0, 4000) : null,
        ipAddress: req?.ip ? String(req.ip).slice(0, 80) : null,
      },
    });
  } catch (error) {
    console.error('Не удалось записать действие:', error.message);
  }
}

module.exports = { recordActivity };
