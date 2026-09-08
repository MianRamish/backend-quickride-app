const NIGERIA_PHONE_REGEX = /^\+234[789]\d{9}$/;

function normalizeNigeriaPhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");

  if (digits.length === 13 && digits.startsWith("234")) {
    const normalized = `+${digits}`;
    return NIGERIA_PHONE_REGEX.test(normalized) ? normalized : "";
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    const normalized = `+234${digits.slice(1)}`;
    return NIGERIA_PHONE_REGEX.test(normalized) ? normalized : "";
  }

  if (digits.length === 10 && /^[789]/.test(digits)) {
    const normalized = `+234${digits}`;
    return NIGERIA_PHONE_REGEX.test(normalized) ? normalized : "";
  }

  return "";
}

function isValidNigeriaPhone(value) {
  return NIGERIA_PHONE_REGEX.test(normalizeNigeriaPhone(value));
}

module.exports = {
  NIGERIA_PHONE_REGEX,
  normalizeNigeriaPhone,
  isValidNigeriaPhone,
};
