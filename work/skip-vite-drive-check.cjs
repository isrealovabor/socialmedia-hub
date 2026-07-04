const childProcess = require("child_process");

const originalExec = childProcess.exec;

childProcess.exec = function patchedExec(command, ...args) {
  if (command === "net use") {
    const callback = args.find((arg) => typeof arg === "function");
    if (callback) {
      setImmediate(() => callback(new Error("Skipped mapped-drive check in sandbox"), ""));
    }
    return {
      on() {
        return this;
      },
    };
  }

  return originalExec.call(this, command, ...args);
};
