const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function runPlistBuddy(plistPath, command, allowFailure = false) {
  try {
    execFileSync("/usr/libexec/PlistBuddy", ["-c", command, plistPath], {
      stdio: allowFailure ? "ignore" : "inherit"
    });
  } catch (error) {
    if (!allowFailure) throw error;
  }
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appName = fs.readdirSync(context.appOutDir).find((entry) => entry.endsWith(".app"));
  if (!appName) return;

  const appPath = path.join(context.appOutDir, appName);
  const plistPath = path.join(appPath, "Contents", "Info.plist");

  [
    "NSCameraUsageDescription",
    "NSMicrophoneUsageDescription",
    "NSBluetoothAlwaysUsageDescription",
    "NSBluetoothPeripheralUsageDescription"
  ].forEach((key) => runPlistBuddy(plistPath, `Delete :${key}`, true));

  runPlistBuddy(plistPath, "Delete :NSAppTransportSecurity:NSAllowsArbitraryLoads", true);
  runPlistBuddy(plistPath, "Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true", true);
  runPlistBuddy(plistPath, "Set :NSAppTransportSecurity:NSAllowsLocalNetworking true", true);

  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit"
  });
};
