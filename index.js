"use strict";

const { Fit } = require("fit");
const conf = require("./config");

async function startApp() {
  let handler = null;
  await Fit.init().then(async () => {
    process.on("SIGTERM", function () {
      if (!handler) {
        process.exit(0);
      }

      handler.shutdown(function () {
        process.exit(0);
      });
      process.exit(0);
    });
    // if (conf.mode === "consumer") {
      handler = require("./app/consumer");
      await handler.startConsumer();
    // }  else {
    //   throw new Error("Invalid mode");
    // }
  });
}

// Call the async function to start the application
startApp().catch((error) => {
  console.error("Error starting the application:", error);
  process.exit(1);
});
