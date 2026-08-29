# Android Client

The standalone Android client lives in `android/` and targets the host API
documented in `PLAN.md`.

## Surface

- First screen is the Codex CLI console: gateway URL, bearer token, session
  list, terminal output, command start/stop, and input send controls. It starts
  empty rather than showing a fake session; after a successful connection with
  no remote sessions, it creates the default Codex CLI process through the host.
- `RemoteClient` uses a single background executor and Android main-thread
  callbacks. It supports `GET /api/v1/sessions`, `POST /api/v1/sessions`,
  `POST /api/v1/sessions/:id/input`, `POST /api/v1/sessions/:id/stop`, and
  cursor polling at `GET /api/v1/sessions/:id/output?cursor=N`.
- The client sends `Authorization: Bearer ...` when a token is entered and
  persists the URL/token in local preferences. Empty remote session lists
  automatically start the default `codex` session after connecting.

## Files

- `android/app/src/main/java/com/codex/remote/MainActivity.kt`
- `android/app/src/main/java/com/codex/remote/RemoteClient.kt`
- `android/app/src/main/java/com/codex/remote/Models.kt`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/build.gradle.kts`

## Verification

Baseline command: `cd android && ./gradlew --version` -> Gradle 9.6.1,
exit 0. Modified command: `cd android && ./gradlew :app:assembleDebug` ->
`BUILD SUCCESSFUL`, exit 0. APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

The latest APK was installed successfully on USB device `10AE6J03LC001JL`.
UIAutomator verification showed the workbench title, gateway URL and
bearer-token fields, `Codex CLI sessions`, terminal output, and `Start`,
`Stop`, and `Send` controls. The current source does not insert a fake preview
session; an empty list becomes a real Codex session after **Connect**.

Rollback evidence is under
`verification/android-client-20260822/` (`MODIFIED_FILE`, `DIFF_FILE`,
`VERIFICATION.txt`, and executable `ROLLBACK.sh`). The script restores only a
rollback-test copy and leaves the modified implementation and APK intact.
