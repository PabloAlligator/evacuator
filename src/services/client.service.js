const { normalizePhone, formatPhone, normalizeSearch } = require('../lib/validation');

async function upsertClient(tx, input) {
  const phoneNormalized = normalizePhone(input.phone);
  const phone = formatPhone(phoneNormalized);
  const existing = await tx.client.findUnique({ where: { phoneNormalized } });
  const name = input.name || existing?.name || null;
  const defaultVehicle = input.vehicle || existing?.defaultVehicle || null;
  const searchText = normalizeSearch(name, phone, phoneNormalized, defaultVehicle, existing?.notes);

  if (existing) {
    return tx.client.update({
      where: { id: existing.id },
      data: { phone, name, defaultVehicle, searchText },
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
