const { normalizePhone, formatPhone, normalizeSearch } = require('../lib/validation');

async function upsertClient(tx, input) {
  const rawPhone = String(input.phone ?? '').trim();
  const phoneNormalized = rawPhone ? normalizePhone(rawPhone) : null;
  const phone = phoneNormalized ? formatPhone(phoneNormalized) : null;

  let existing = phoneNormalized
    ? await tx.client.findUnique({ where: { phoneNormalized } })
    : null;

  if (!existing && input.clientId) {
    existing = await tx.client.findUnique({ where: { id: input.clientId } });
  }

  const name = input.name || existing?.name || null;
  const defaultVehicle = input.vehicle || existing?.defaultVehicle || null;
  const searchText = normalizeSearch(name, phone, phoneNormalized, defaultVehicle, existing?.notes);

  if (existing) {
    return tx.client.update({
      where: { id: existing.id },
      data: { phone, phoneNormalized, name, defaultVehicle, searchText, deletedAt: null },
    });
  }

  return tx.client.create({
    data: { phone, phoneNormalized, name, defaultVehicle, searchText },
  });
}

function clientSearchText(client) {
  return normalizeSearch(client.name, client.phone, client.phoneNormalized, client.defaultVehicle, client.notes);
}

module.exports = { upsertClient, clientSearchText };
