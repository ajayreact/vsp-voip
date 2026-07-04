function getApiPublicBase() {
  return (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
}

module.exports = { getApiPublicBase };
