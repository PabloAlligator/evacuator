const readline = require('readline/promises');
const { stdin, stdout } = require('process');
const { Writable } = require('stream');
const prisma = require('../src/lib/prisma');
const { hashPassword, normalizeEmail, validEmail, validPassword } = require('../src/lib/security');
const { validateEnv } = require('../src/config/env');

async function main() {
  validateEnv();
  let muted = false;
  const protectedOutput = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) stdout.write(chunk, encoding);
      callback();
    },
  });
  const terminal = readline.createInterface({ input: stdin, output: protectedOutput, terminal: true });
  try {
    const name = (await terminal.question('Имя владельца: ')).trim();
    const email = normalizeEmail(await terminal.question('Email: '));
    stdout.write('Пароль (12–128 символов): ');
    muted = true;
    const password = await terminal.question('');
    muted = false;
    stdout.write('\n');
    if (!name) throw new Error('Имя обязательно');
    if (!validEmail(email)) throw new Error('Email указан неверно');
    if (!validPassword(password)) throw new Error('Пароль должен содержать 12–128 символов');

    const passwordHash = await hashPassword(password);
    const owner = await prisma.user.upsert({
      where: { email },
      update: { name, passwordHash, role: 'OWNER', isActive: true },
      create: { name, email, passwordHash, role: 'OWNER' },
    });
    await prisma.session.deleteMany({ where: { userId: owner.id } });
    console.log(`Владелец ${owner.email} создан. Старые сессии завершены.`);
  } finally {
    terminal.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
