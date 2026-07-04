/** Thin wrapper so V3 modules can be mocked in tests without loading db.js graph. */
/** @type {(() => Promise<import('@prisma/client').PrismaClient>) | null} */
let getPrismaImpl = null;

function getPrisma() {
  if (!getPrismaImpl) {
    getPrismaImpl = require('../../../db').getPrisma;
  }
  return getPrismaImpl();
}

/** @param {() => Promise<import('@prisma/client').PrismaClient>} fn */
function __setGetPrismaForTests(fn) {
  getPrismaImpl = fn;
}

function __resetGetPrismaForTests() {
  getPrismaImpl = null;
}

module.exports = {
  getPrisma,
  __setGetPrismaForTests,
  __resetGetPrismaForTests,
};
