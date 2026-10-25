// Shapes returned by the API. Keep secrets (password hash, reset tokens)
// out of every response by only ever sending these.

const tailor = (t) => ({
  id:        t.id,
  shopName:  t.shopName,
  email:     t.email,
  createdAt: t.createdAt,
});

const client = (c) => ({
  id:        c.id,
  clientId:  c.clientId,
  name:      c.name,
  phone:     c.phone,
  email:     c.email,
  notes:     c.notes,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const parseFields = (raw) => {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const measurement = (m) => ({
  id:          m.id,
  outfitType:  m.outfitType,
  description: m.description,
  fields:      parseFields(m.fields),
  notes:       m.notes,
  createdAt:   m.createdAt,
  updatedAt:   m.updatedAt,
});

module.exports = { tailor, client, measurement };
