export type AttributeInput = {
  mind?: number | null;
  body?: number | null;
  soul?: number | null;
};

const clampAttribute = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
};

export const normalizeAttributes = (attributes: AttributeInput = {}) => ({
  mind: clampAttribute(attributes.mind),
  body: clampAttribute(attributes.body),
  soul: clampAttribute(attributes.soul),
});

export const calculateBaseStat = (stage: number) => 20 + stage * 8;

const buildStatValue = (base: number, primary: number, secondaryA: number, secondaryB: number) => {
  const primaryContribution = primary * 0.4;
  const supportContribution = ((secondaryA + secondaryB) / 2) * 0.1;
  return Math.floor(base + primaryContribution + supportContribution);
};

export const calculateStats = (stage: number, attributes: AttributeInput = {}) => {
  const { mind, body, soul } = normalizeAttributes(attributes);
  const base = calculateBaseStat(stage);

  return {
    mind: buildStatValue(base, mind, body, soul),
    body: buildStatValue(base, body, mind, soul),
    soul: buildStatValue(base, soul, mind, body),
  };
};

export const calculateEnergyCost = (stage: number) => {
  if (stage <= 9) return 1;
  if (stage <= 14) return 2;
  return 3;
};

export const calculateBondLevel = (stage: number, attributes: AttributeInput = {}) => {
  const { mind, body, soul } = normalizeAttributes(attributes);
  const totalAttributes = mind + body + soul;
  return Math.min(100, Math.floor(10 + totalAttributes / 3 + stage * 2));
};
