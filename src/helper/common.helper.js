function generateUniqueString() {
  const randomString = Math.random().toString(36).substring(2, 15);
  const timestamp = new Date().getTime();
  return `${timestamp}_${randomString}`;
}

module.exports = {
  generateUniqueString,
};
