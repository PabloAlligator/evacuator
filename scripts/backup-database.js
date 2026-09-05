const fs = require('fs');
const path = require('path');
const prisma = require('../src/lib/prisma');
const { env, validateEnv } = require('../src/config/env');

async function main() {
  validateEnv();
  if (!env.databaseUrl.startsWith('file:')) throw new Error('Скрипт резервного копирования предназначен для SQLite');
  const backupDir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(backupDir, `evakuator19-${timestamp}.db`);
  const escaped = target.replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);
  fs.chmodSync(target, 0o600);

  const cutoff = Date.now() - env.backupRetentionDays * 86400000;
  for (const item of fs.readdirSync(backupDir, { withFileTypes: true })) {
    if (!item.isFile() || !/^evakuator19-.*\.db$/.test(item.name)) continue;
    const filePath = path.join(backupDir, item.name);
    if (fs.statSync(filePath).mtimeMs < cutoff) fs.unlinkSync(filePath);
  }
  console.log(`Резервная копия создана: ${target}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
