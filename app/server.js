require("newrelic");
const nunjucks = require("nunjucks");
const { Fit } = require("fit");
require("./kafka.init");
function initApp() {
  try {
    Fit.Server.start();
    Fit.Server.app.set("view engine", "njk");
    nunjucks.configure("views", {
      express: Fit.Server.app,
      autoescape: true,
    });
    return Fit.Server.app;
  } catch (err) {
    console.error(err);
  }
}

module.exports = initApp;
