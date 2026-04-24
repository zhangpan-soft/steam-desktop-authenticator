# Release Smoke Test

Use this checklist before publishing a release or after installing a freshly built package.

## Install and Startup

- Install the package for the current platform.
- Launch the app successfully.
- Confirm the main window shows the expected version in the footer.
- If the local SDA data is encrypted, confirm the passkey dialog blocks access until a valid passkey is entered.

## Account Basics

- Select an account from the account list.
- Confirm the selected account name appears in the header.
- Confirm the Steam Guard token is generated and the progress bar moves.
- Click Copy and confirm the token is copied.

## Login and Session

- Use Login Again on the selected account and complete login.
- Use Force Refresh and confirm it reports success for a valid session.
- If possible, test one expired account and confirm a per-account relogin window opens.
- Confirm a successful relogin closes only that account's relogin window.

## Confirmations

- Open View Confirmations for the selected account.
- Confirm empty, no-guard, expired-session, and timeout states show readable messages.
- If a real confirmation exists, confirm detail view opens.
- If safe to do so, test accept or reject.

## CS2 Inventory

- Open Selected Account > CS2 Inventory.
- Confirm items render natively instead of opening a Steam web page.
- Confirm marketable, tradable, and cooldown information is visible where applicable.
- Search by name, type, paint index, or float.
- Refresh inventory and confirm errors are readable if the session/network is invalid.

## Import, Export, and Encryption

- Export the current account as plaintext.
- Export all accounts as encrypted with a temporary export passkey.
- Confirm the temporary export passkey does not change the SDA unlock passkey.
- Import at least one exported `.maFile` into a clean folder if possible.

## Updates

- Confirm the GitHub Release is published, not left as draft.
- Confirm release assets include platform packages, `latest*.yml`, and `.blockmap` files.
- In a packaged app, click Check for updates.
- Confirm development mode reports that updates cannot be checked.

## Security Sanity

- Avoid sharing logs containing account names unless needed.
- Confirm logs do not print access tokens, refresh tokens, cookies, shared secrets, identity secrets, passkeys, or passwords.
