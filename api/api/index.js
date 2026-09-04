const { createApp } = require("../src/index");

let appPromise;

module.exports = async function handler(req, res) {
  if (!appPromise) appPromise = createApp();
  const app = await appPromise;
  return app(req, res);
};
