# WhatsApp Business (Cloud API)

One NestPro Meta app. Each shop connects its own WABA via official Embedded Signup. Tokens stay on the server, encrypted.

```
Shop owner  →  Connect WhatsApp  →  Meta Embedded Signup  →  Nest stores WABA + phone + token
Appointment →  WhatsAppService   →  Graph Cloud API       →  customer WhatsApp
Meta        →  webhook           →  Sent / Delivered / Read / Failed
```

Shop A never uses Shop B credentials. `shopId` comes from the JWT, never from the client body.

## What is already in code

- `GET /integrations/whatsapp` — status for the signed-in shop
- `POST /integrations/whatsapp/connect` — ticket + public Meta ids
- `GET /integrations/whatsapp/signup/:ticket` — Embedded Signup HTML (FB JS SDK)
- `POST /integrations/whatsapp/complete` — exchange `code`, store assets
- `POST /integrations/whatsapp/disconnect`
- `POST /integrations/whatsapp/test`
- `GET|POST /webhooks/meta/whatsapp` — verify + HMAC + idempotent status updates

If `META_APP_ID` / `META_APP_SECRET` / `META_CONFIG_ID` are missing, APIs return a configuration error. The UI does **not** fake Connected.

## Server env (`Nest/.env`)

Copy from `.env.example`. Never commit real values.

```
META_APP_ID=
META_APP_SECRET=
META_CONFIG_ID=
META_GRAPH_API_VERSION=v21.0
META_WEBHOOK_VERIFY_TOKEN=
WA_TOKEN_KEY=
WA_TEST_TEMPLATE=
PUBLIC_API_URL=https://your-public-host
```

`META_APP_SECRET` and tokens never go to the app.

`WA_TOKEN_KEY` is optional. If empty, encryption derives from `JWT_SECRET`. Set a dedicated key in production.

`WA_TEST_TEMPLATE` is an **approved** template name on the connected WABA. Free-form text only works inside Meta’s 24-hour customer-care window.

## Meta Developer Console (verify against live docs)

Requirements change. Recheck:

https://developers.facebook.com/docs/whatsapp/embedded-signup  
https://developers.facebook.com/docs/whatsapp/cloud-api  
https://developers.facebook.com/docs/graph-api/webhooks/getting-started

Typical setup:

1. Create **one** Meta app for NestPro (Business type).
2. Add the **WhatsApp** product.
3. Create an **Embedded Signup** configuration → copy `META_CONFIG_ID`.
4. App Dashboard → Settings → Basic → `META_APP_ID`, `META_APP_SECRET`.
5. Add your public HTTPS origin to App Domains / Valid OAuth Redirect URIs.
6. WhatsApp → Configuration → webhook URL:

   `https://<public-host>/webhooks/meta/whatsapp`

   Verify token = `META_WEBHOOK_VERIFY_TOKEN`. Subscribe to `messages`.
7. Permissions commonly required for Embedded Signup (confirm in current Meta UI):

   `whatsapp_business_management`, `whatsapp_business_messaging`, `business_management`
8. Development mode: add Meta testers. Production: App Review + Advanced Access + Business Verification as Meta currently requires.

## Local setup (ngrok)

Nest stays on `localhost:3000`. Meta only talks HTTPS.

```
ngrok http 3000
```

Copy the `https://….ngrok-free.app` URL into `PUBLIC_API_URL`. Free ngrok URL changes every restart — update `.env` + Meta domains when it changes.

Keep that ngrok process running while you test Connect / webhooks.

```
Meta App  →  tunnel HTTPS  →  local Nest  →  Postgres
```

Embedded Signup itself needs the FB JS SDK. The signup page is served by Nest so the WebView has a real origin. For production that origin must be HTTPS and listed on the Meta app.

## Customer path

1. Barber app → Shop → WhatsApp → Connect WhatsApp
2. Meta login + asset selection
3. App posts `code` (+ optional `waba_id` / `phone_number_id`) to `/complete`
4. Nest exchanges the code server-side, encrypts the token, marks Connected
5. Test message or appointment confirmation uses that shop’s WABA only

## Greeting on add client

Add client → Nest send welcome WhatsApp (first contact = **template**).

Create in WhatsApp Manager, name `client_welcome`, language `en`, Utility, body:

```
Hi {{1}}, welcome to {{2}}. Reply here to book your next visit.
```

Then `.env`:

```
WA_GREETING_TEMPLATE=client_welcome
WA_TEMPLATE_LANG=en
```

Restart Nest. Client still save if send fail.

Shop `followUpDays` default 45. Each client get `followUpDueAt`. Loyalty follow-up cron still later.

Appointment reminders: cron every 15 min. `remindAt` = shop-open hour on the booking day. If that day is a weekly off, `remindAt` moves to the next open day. No send on holidays.

WhatsApp message rows are **not written**. Delivery lives in WhatsApp / Meta. Platform only stores the shop connection.

## Sending from CRM code

```ts
this.wa.notifyAppointment(shopId, {
  kind: 'appointment_confirmation',
  phone, customerName, serviceName, when, shopName,
});
```

`appointment_confirmation`, `appointment_cancellation`, `appointment_reschedule` fire on book/cancel/move. `appointment_reminder` fires from the 15-min cron (skipped / pushed if shop holiday). No marketing send.

## Production checklist

- [ ] Meta app + WhatsApp product
- [ ] Embedded Signup config id
- [ ] Production HTTPS callback / signup origin
- [ ] Webhook URL + signature verification (already in code)
- [ ] Tokens encrypted (`accessTokenEnc`)
- [ ] App secret server-only
- [ ] Per-shop authorization
- [ ] Approved templates if sending outside the 24h window
- [ ] App Review / Business Verification as Meta requires
- [ ] No secrets in git
