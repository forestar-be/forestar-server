function generateUniqueString() {
  const randomString = Math.random().toString(36).substring(2, 15);
  const timestamp = new Date().getTime();
  return `${timestamp}_${randomString}`;
}

const formatPriceNumberToFrenchFormatStr = (number) => {
  return number.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  });
};

const stringifyIfPossible = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    return String(obj);
  }
};

module.exports = {
  generateUniqueString,
  formatPriceNumberToFrenchFormatStr,
  stringifyIfPossible,
};
