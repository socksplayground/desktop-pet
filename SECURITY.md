# Security Notes

This project is designed as a local desktop pet app.

## Current Security Posture

- The packaged app does not start a network server.
- The development preview server binds only to `127.0.0.1`.
- Electron `nodeIntegration` is disabled.
- Electron `contextIsolation` and `sandbox` are enabled.
- Content Security Policy blocks external connections.
- Window navigation and new-window creation are blocked.
- Permission requests are denied by default.
- The packaging hook removes camera, microphone, and Bluetooth usage descriptions.
- The packaging hook removes `NSAllowsArbitraryLoads` and keeps only localhost / 127.0.0.1 exceptions.

## Reporting Issues

If you find a security problem, please open a private report or contact the project owner before posting exploit details publicly.

## Distribution Notes

The default build uses ad-hoc signing. For wider public distribution, use an Apple Developer ID certificate and notarize the app.
