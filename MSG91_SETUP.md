# MSG91 phone login

The website and mobile app send and verify phone OTPs through the BuildMate API. The API uses MSG91 to deliver SMS;
MSG91 credentials must stay on the server and must never be added to client-side environment variables or app builds.

## Production setup

1. In the root `.env` used by Docker Compose, set:

   ```dotenv
   SMS_PROVIDER=Msg91
   MSG91_AUTH_KEY=<server-side MSG91 auth key>
   MSG91_OTP_TEMPLATE_ID=<approved OTP template ID>
   ```

2. Ensure the MSG91 template is approved and DLT-registered, uses the configured six-digit OTP variable, and supports
   the phone numbers you intend to serve.
3. Rebuild/restart the API after changing the settings:

   ```bash
   docker compose up -d --build api
   ```

4. Configure the website and mobile app with the public API URL only. The website proxies `/api` through its Next.js
   server; mobile builds use `--dart-define=API_URL=https://<api-host>`.
5. Test sending, verification, existing-account login, and new-account signup before release. OTP limits and expiry
   are controlled by the API's `Otp` settings.

For a non-Docker API deployment, set `Sms__Provider=Msg91`, `Sms__Msg91AuthKey`, and
`Sms__Msg91OtpTemplateId` in the API server's environment.

## Local development

The API's Development profile can use the `Log` SMS provider, which writes OTPs to the API log. Configured development
test numbers can use their fixed test codes. Do not use the `Log` provider for production.

Phone authentication endpoints are:

- `POST /api/auth/otp/request`
- `POST /api/auth/otp/verify`

The API verifies the code and issues BuildMate access/refresh tokens. The browser and app never call MSG91 directly
and never receive the MSG91 auth key.

Mobile push notifications are not configured. In-app notifications continue to be stored and served by the API.
