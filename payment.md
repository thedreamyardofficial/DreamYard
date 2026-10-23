# DreamYard payments (Razorpay): code, setup, testing and operations

This document covers everything in the payment section: how it works, every file that was added or changed, what to enter in the Razorpay Dashboard, how to test it on your own computer without deploying, and how to find bugs.

Contents

1. What was already there and what this change adds
2. How a payment flows
3. Files added and changed
4. Code walkthrough
5. API reference
6. Data stored
7. Security design
8. Environment variables
9. Razorpay Dashboard: what to enter where
10. Testing on your computer without deploying
11. Finding payment bugs (playbook)
12. Going live checklist
13. Limits of this implementation
14. What was verified, and what was not

---

## 1. What was already there and what this change adds

Your project already had order creation, checkout in the browser, signature verification and stock handling. It had no webhooks, and the payment code had gaps that could lose a customer's money or an order.

Problems in the original code that are now fixed:

| Problem | Effect before | Now |
|---|---|---|
| No webhooks | If the customer closed the tab or lost connection after paying, money was taken and no order existed | Razorpay calls the server directly, and the order is created even if the browser never comes back |
| `reserveStock(attempt.items)` was called without its second argument | An out-of-stock item after payment crashed with a `TypeError` (customer paid, no order, no refund) | Stock shortage after payment triggers an automatic refund |
| Paid but order creation failed | Customer charged, no order | Everything is rolled back and retried by Razorpay's webhook retries, a retry job and the status check |
| Verify and any other path could both create an order | Possible double order or double stock deduction | One atomic claim per payment, unique index on payment id, stock flag |
| Verify shared a 20-per-15-minutes limit with order creation, per IP | Customers behind one shared IP could be blocked from confirming a payment they had already made | Confirm and status calls are limited per signed-in user (120 per 15 minutes) |
| No size check, no cap on items, unchecked ids | Odd input reached the database | Size must be one of the product's sizes, 50 lines maximum, ids validated |
| Gateway errors were not Errors (the Razorpay SDK rejects with plain objects) | Blank or wrong error to the customer | Errors are logged in detail and shown as a safe message with status 502 |
| Admin always showed "Captured" | Refunds invisible | Admin shows Captured, Partially refunded or Refunded and the refunded amount |

Added: the webhook endpoint, duplicate-delivery protection, auto-refund for unfulfillable payments, a background reconciliation job, a payment status endpoint, and browser recovery of an interrupted payment.

---

## 2. How a payment flows

```
Browser (React)                    Your server (Express)                    Razorpay
      |                                   |                                    |
 1.   |-- POST /orders/razorpay/order --->|                                    |
      |   (address id + cart lines)       | rebuilds prices from the database  |
      |                                   |-- orders.create (amount in paise)->|
      |                                   |<-- order_xxx ----------------------|
      |                                   | saves PaymentAttempt (pending)     |
      |<-- keyId, orderId, amount --------|                                    |
 2.   |-- Razorpay Checkout opens, customer pays ---------------------------->|
 3a.  |<-- handler(order_id, payment_id, signature) ---------------------------|
      |-- POST /orders/razorpay/verify -->| checks signature                   |
      |                                   |-- payments.fetch (source of truth)->|
      |                                   | finalizePayment()                  |
      |<-- order summary -----------------|                                    |
 3b.  |                                   |<-- webhook payment.captured -------|
      |                                   | checks signature on raw body       |
      |                                   | finalizePayment()  (same function) |
```

Steps 3a and 3b race on purpose. Whichever arrives first creates the order, and the other finds it already done. If neither the browser nor the webhook gets through, the status endpoint and the background job ask Razorpay directly.

`finalizePayment()` does this, in order:

1. Loads the checkout record and compares the payment fetched from Razorpay with it: same Razorpay order, same amount in paise, currency INR, status `authorized` or `captured`. Anything else is refused.
2. If an order already exists for this payment id, returns it.
3. Claims the checkout atomically (`pending` to `processing`). Only one caller wins. A claim older than 2 minutes is treated as a crashed worker and can be taken over.
4. Reserves stock. If any item is short, it is put back and:
   - payment already captured: the full amount is refunded automatically, checkout becomes `refunded`;
   - payment only authorized: it is never captured, checkout becomes `released` (Razorpay releases the hold by itself, 3 days by default).
5. Captures the payment if it is only authorized.
6. Creates the order. The unique index on the Razorpay payment id makes a second order impossible.
7. Marks the checkout `completed`.
8. If anything fails between steps 4 and 7, stock is put back and the checkout returns to `pending`, so a retry can run the whole thing again.

---

## 3. Files added and changed

Server (`server/`)

| File | Change |
|---|---|
| `src/utils/payments.js` | New. `finalizePayment`, `syncAttempt`, `reconcilePendingPayments`, `startPaymentReconciler`, gateway error handling |
| `src/utils/stock.js` | New. `tryReserveStock` and `releaseStock` (moved out of the controller so payments and Pay on Delivery share them) |
| `src/controllers/webhookController.js` | New. Webhook endpoint |
| `src/routes/webhookRoutes.js` | New. `POST /api/webhooks/razorpay` with its own rate limit and raw body |
| `src/models/WebhookEvent.js` | New. One record per webhook delivery, auto-deleted after 30 days |
| `src/controllers/orderController.js` | Rewritten payment parts: create order, verify, status. Pay on Delivery behaviour unchanged except the stricter input checks |
| `src/routes/orderRoutes.js` | Added status route, per-user limiter, `Cache-Control: no-store` |
| `src/models/PaymentAttempt.js` | New fields and statuses, TTL cleanup of abandoned checkouts |
| `src/models/Order.js` | Added `paymentStatus` and `refundedAmount` |
| `src/config/env.js` | New required `RAZORPAY_WEBHOOK_SECRET`, format checks, test/live key warnings |
| `src/app.js` | Webhook router mounted before `express.json()` (needs the raw body) |
| `src/server.js` | Starts and stops the reconciliation job |
| `src/controllers/admin/userAdmin.js` | Selects the two new order fields |
| `.env.example` | Documents `RAZORPAY_WEBHOOK_SECRET` |

Client (`client/`)

| File | Change |
|---|---|
| `src/pages/Checkout.jsx` | Safer handling after payment, polling when confirmation is interrupted, recovery when the customer returns |
| `src/api/client.js` | Errors now carry `status`, new `paymentStatus` call |
| `src/admin/pages/OrdersAdmin.jsx`, `UsersAdmin.jsx` | Show real payment status and refunded amount |

Nothing else in the project was changed. `razorpay.js`, the CSP in `app.js`, authentication and the rest are as they were.

No `package.json` change is needed: Node's `crypto` is used, and the `razorpay` package you already have provides every call used.

---

## 4. Code walkthrough

### `utils/payments.js`

- `toPaise(rupees)`: rounds to whole paise. The amount sent to Razorpay and the amount compared later both use it.
- `isGatewayId("order" | "pay", value)`: accepts only strings shaped like `order_AbC123...` and `pay_AbC123...`. Used on every id coming from a browser or webhook, so objects such as `{ "$ne": null }` never reach a database query.
- `gatewayError()` and `toHttpError()`: the SDK throws plain objects. These log the real reason on the server and give the customer a generic message with status 502.
- `finalizePayment(attemptId, payment, { signature })`: described in section 2. `payment` must always come from `razorpay.payments.fetch` (or `orders.fetchPayments`), never from the browser.
- `capturePayment()`: if capture fails but the payment is in fact captured (automatic capture won the race), that counts as success.
- `refundPayment()`: if the refund call fails but Razorpay says the payment is already fully refunded (a previous run succeeded but could not save), that counts as success. This prevents double refunds.
- `readSettlement(attempt)`: turns a finished checkout into the same result shape `finalizePayment` returns.
- `syncAttempt(attempt)`: asks Razorpay for the payments on an order, picks the captured (or else authorized) one and finalizes it.
- `waitForSettlement()`: when the browser's verify call finds the webhook already working on the same payment, wait up to 8 seconds for it to finish and return its result.
- `reconcilePendingPayments()`: for unpaid checkouts, asks Razorpay at ages of 10 minutes, 1 hour, 6 hours, 24 hours and 72 hours, then stops. At most 20 per stage per run. Safe to run on several server instances because claims are atomic. It exists for the case where a webhook is missed.
- `startPaymentReconciler()`: runs the job 30 seconds after start and then every 5 minutes. The timers do not keep the process alive.

### `controllers/orderController.js`

- `prepareOrder()`: shared by Pay on Delivery and Razorpay. Rebuilds everything from the database: published products only, database price, size must be one of the product's sizes, quantity 1 to 10, at most 50 lines, address must be one of the signed-in user's saved addresses.
- `createRazorpayOrder()`: minimum payable is ₹1. Creates the Razorpay order with `notes: { app: "dreamyard", user }` and a random receipt, then saves the `PaymentAttempt`.
- `verifyRazorpayPayment()`: validates id formats, checks the signature `HMAC_SHA256(order_id + "|" + payment_id, key_secret)` in constant time, requires the checkout to belong to the signed-in user, fetches the payment from Razorpay and calls `finalizePayment`.
- `razorpayPaymentStatus()`: the browser's way to find out what happened. If the checkout is not finished it asks Razorpay once, so even a missed webhook is repaired the moment the customer looks.

### `controllers/webhookController.js`

1. Rejects with 400 unless `X-Razorpay-Signature` equals `HMAC_SHA256(raw body, webhook secret)` (constant time, hex).
2. Parses the JSON only after the signature is valid.
3. Uses the `X-Razorpay-Event-Id` header as the event id. The first delivery is recorded; a repeat that already finished returns `{ ok: true, duplicate: true }`; a repeat of one that failed is processed again.
4. Dispatches by event:

| Event | Action |
|---|---|
| `payment.authorized`, `payment.captured`, `order.paid` | Fetch the payment from Razorpay, find the checkout by Razorpay order id, run `finalizePayment` |
| `payment.failed` | Store the failure reason on the checkout. The checkout stays open because the customer can retry on the same Razorpay order |
| `refund.created`, `refund.processed`, `refund.failed` | Fetch the payment, set the order's `paymentStatus` and `refundedAmount` from Razorpay's `amount_refunded` |
| anything else | Acknowledged and ignored |

5. Answers 200 on success. On failure answers 500, which makes Razorpay retry with back-off for 24 hours. The handlers are safe to repeat.

The event payload is only used to find which payment to look at. The facts (status, amount, refunded amount) are always read from Razorpay's API, so the code does not depend on payload details that differ between events, and a replayed old payload cannot change state.

### `routes/webhookRoutes.js` and `app.js`

The webhook is mounted before `express.json()` because the signature must be computed over the exact bytes Razorpay sent. It sits before CORS because Razorpay calls the server directly, with no browser origin. It has its own limit (600 requests a minute) and a 256 KB body limit.

### `models/PaymentAttempt.js`

Statuses: `pending`, `processing`, `completed`, `refunded`, `released`. Checkouts that never received a payment (`pending`) are deleted after 30 days by a partial TTL index. Anything that received a payment is kept.

### `Checkout.jsx`

- After a successful payment it calls verify. If verify fails because of a network problem, a server error or "still confirming" (HTTP 409), it polls the status endpoint (10 tries, 3 seconds apart) before saying anything, because the money may already be taken.
- The Razorpay order id is stored in the browser (`localStorage`, 24 hours). If the customer closes the page and returns, the checkout page asks the server what happened and shows the finished order or the refund message.
- A closed payment window is only reported as "cancelled" when no payment was submitted.

---

## 5. API reference

| Method and path | Auth | Purpose |
|---|---|---|
| `GET /api/orders/payment-config` | none | `{ enabled, keyId }` (the key id is public by design) |
| `POST /api/orders/razorpay/order` | customer | Body `{ addressId, items: [{ productId, size, qty }] }`. Returns `201 { keyId, orderId, amount, currency }`. Limit 20 per 15 minutes per IP |
| `POST /api/orders/razorpay/verify` | customer | Body `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }`. `201` new order, `200` order already existed, both with `{ _id, total, customer: { name } }` |
| `GET /api/orders/razorpay/status/:razorpayOrderId` | customer | `{ status: "completed", order }`, `{ status: "refunded" or "released", message }` or `{ status: "pending" }` |
| `POST /api/webhooks/razorpay` | HMAC signature | Razorpay events. `200` handled, `400` bad signature or body, `404` payments disabled, `500` retry me |

Verify and status responses on failure:

| Status | Meaning |
|---|---|
| 400 | Bad ids or signature, payment does not match the checkout, or payment not successful |
| 401 | Not signed in |
| 409 | Payment taken but order not possible (refund or release message), or still being confirmed |
| 502 | Razorpay could not be reached |

---

## 6. Data stored

`paymentattempts` (one per checkout): user, delivery details, items with database prices, `total`, `razorpayOrderId` (unique), `razorpayPaymentId`, `status`, `completedOrder`, `stockReserved`, `processingStartedAt`, `failureReason`, `lastPaymentError`, `refundId`, `reconcileCount`.

`orders` (Razorpay orders): everything as before plus `paymentStatus` (`captured`, `partially_refunded`, `refunded`) and `refundedAmount` in paise. Old Razorpay orders without `paymentStatus` display as Captured.

`webhookevents`: `eventId` (unique), `event`, `status`, `attempts`, `result`, `lastError`. Deleted after 30 days.

Card, UPI and bank details are never seen or stored by your server. They go from the customer's browser to Razorpay.

Indexes are created automatically the first time the server starts after this change.

---

## 7. Security design

| Risk | Control |
|---|---|
| Customer changes the price | Amount is computed on the server from database prices; the browser sends only product ids, sizes and quantities |
| Forged "payment succeeded" request to verify | HMAC signature with the key secret, constant-time comparison, plus the payment is fetched from Razorpay and its order, amount and currency are compared |
| Forged webhook | HMAC-SHA256 over the raw body with a separate webhook secret, constant-time comparison, JSON parsed only afterwards |
| Using someone else's payment | The checkout must belong to the signed-in user; payment, order id and amount must all match |
| Replay or duplicate webhook | Event id recorded; processing is idempotent anyway; unique index on payment id |
| Race between browser and webhook | Atomic claim on the checkout; stale claims can be taken over |
| NoSQL injection | Ids are validated as strings of the expected shape before any query |
| Key secret exposure | Only the server holds `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`. Only the public key id reaches the browser. Secrets are never logged |
| Wrong secrets or keys | Server refuses to start if the key id is malformed, the webhook secret is under 16 characters or equal to the key secret. Warns about test keys in production and live keys outside it |
| Double refund or double capture | Refund and capture errors are checked against Razorpay's real state before being treated as failures |
| Cached payment responses | `Cache-Control: no-store` on payment routes |
| Webhook flooding | Own rate limit, 256 KB body cap, signature checked before any database work |
| Customer blocked after paying | Confirm and status limits are per user, not per IP |
| Error details leaking | Gateway failures are logged server-side and shown as a generic message; production hides unexpected 500 text |
| Insecure transport | Use HTTPS only. Razorpay requires TLS 1.2 or later |

Two secrets, two jobs, do not mix them:

- `RAZORPAY_KEY_SECRET` (from API Keys): verifies the signature the browser hands over after payment and authenticates calls to Razorpay.
- `RAZORPAY_WEBHOOK_SECRET` (you choose it when creating the webhook): verifies webhooks sent by Razorpay.

---

## 8. Environment variables

`server/.env`

```
RAZORPAY_ENABLED=true
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=the-key-secret-shown-once-in-the-dashboard
RAZORPAY_WEBHOOK_SECRET=a-long-random-string-you-invent
```

Create the webhook secret with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Use the same value in the Dashboard webhook form. Test mode and Live mode have different key pairs and different webhooks, so use a different webhook secret for each if you like.

With `RAZORPAY_ENABLED=false` the site stays on Pay on Delivery and the webhook route answers 404.

`client/.env` needs nothing new. The checkout key id comes from the server.

---

## 9. Razorpay Dashboard: what to enter where

Everything below is done once for Test mode, then again for Live mode. The Test/Live switch is at the top of the Dashboard. The two modes do not share keys, webhooks or data.

**A. Create the API keys**

1. Switch to Test mode.
2. Account & Settings, then API Keys (under Website and app settings), then Generate Key.
3. Copy the Key Id into `RAZORPAY_KEY_ID` and the Key Secret into `RAZORPAY_KEY_SECRET`. The secret is shown only once. If you lose it, regenerate (which invalidates the old pair).

**B. Create the webhook**

1. Account & Settings, then Webhooks (under Website and app settings), then Add New Webhook.
2. Fill the form:

| Field | What to enter |
|---|---|
| Webhook URL | `https://YOUR-BACKEND-HOST/api/webhooks/razorpay` (for local testing this is your tunnel address, see section 10) |
| Secret | The same value as `RAZORPAY_WEBHOOK_SECRET` |
| Alert Email | An email you read. Razorpay writes here if deliveries fail or the webhook is disabled |
| Active Events | Tick exactly these seven: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed` |

3. Click Create Webhook. In Test mode Razorpay asks for an OTP: enter `754081`.

Rules Razorpay enforces on the URL: it must be public (no localhost), use port 80 or 443, must not contain `razorpay` in the domain, and a list of testing domains is blocked (including `ngrok.io`, `loca.lt`, `webhook.site`, `requestbin.com`, `beeceptor.com`).

Razorpay expects a 2xx answer within 5 seconds. Failed deliveries are retried with back-off for 24 hours; after that the webhook is disabled and you must enable it again by hand in the Dashboard (it will email the Alert Email). Events can arrive more than once and not always in order. The code is built for both.

**C. Payment capture setting**

Account & Settings, then Payments Capture. The default, Auto-capture all payments, works with this code. Manual capture also works: the code captures authorized payments itself. Razorpay refunds authorized payments that are not captured within its window (3 days by default), which is what happens for the out-of-stock case.

**D. Before Live mode**

Live keys and Live webhooks need your Razorpay account activated (KYC and business details approved). Generate Live keys, create a second webhook in Live mode with the production URL and a Live secret, and put the Live values only in your hosting provider's environment settings (see section 12).

---

## 10. Testing on your computer without deploying

You can test the whole flow locally. One piece needs a public address: Razorpay's servers must be able to reach your computer to deliver webhooks. A tunnel gives your local server a temporary public HTTPS address.

### Step 1: run the project with test keys

1. Use Test mode keys from section 9A in `server/.env`, with `RAZORPAY_ENABLED=true` and your `RAZORPAY_WEBHOOK_SECRET`.
2. Start both parts as usual (`npm run dev` in `server/` and in `client/`).
3. Open `http://localhost:5173`, sign in, add an address and put a product in the bag.

The browser part of the payment (checkout, verify, order creation) already works at this point with no tunnel.

### Step 2: open a tunnel to port 5000

Razorpay's own documentation says you cannot use localhost and recommends tunnelling, naming `zrok`. Follow zrok's getting-started guide (free account, one-time `zrok enable`), then:

```
zrok share public localhost:5000
```

It prints an `https://...` address. Cloudflare's quick tunnel is another option: `cloudflared tunnel --url http://localhost:5000`. Razorpay's blocklist is not exhaustive and can change, so if the Dashboard refuses an address when you save the webhook, use the other tool. `ngrok.io` and `loca.lt` addresses are on the blocklist.

Prove the tunnel reaches your server before touching the Dashboard (replace HOST):

```
curl -i https://HOST/api/health
curl -i -X POST https://HOST/api/webhooks/razorpay -H "Content-Type: application/json" -d "{}"
```

The first must return 200. The second must return 400 with "Invalid webhook signature." That 400 is the proof that the route is reachable and that unsigned requests are rejected.

### Step 3: register the tunnel as the Test webhook

Create the webhook as in section 9B with the URL `https://HOST/api/webhooks/razorpay`. The tunnel address usually changes each time you restart the tunnel; edit the webhook URL when it does (OTP `754081`).

### Step 4: check the handler with a signed request

This checks your secret and your handler without involving Razorpay at all. Run in a terminal with `RAZORPAY_WEBHOOK_SECRET` set to your value:

```
BODY='{"event":"payment.captured","payload":{}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$RAZORPAY_WEBHOOK_SECRET" -hex | sed 's/^.* //')
curl -i -X POST https://HOST/api/webhooks/razorpay -H "Content-Type: application/json" -H "x-razorpay-signature: $SIG" -H "x-razorpay-event-id: manual-1" -d "$BODY"
```

Expected: 200 and `{"ok":true}`, and a log line `[webhook] payment.captured manual-1: ignored: no payment id`. Run it again: the answer becomes `{"ok":true,"duplicate":true}`. Change one character of `SIG` or `BODY`: the answer must be 400.

### Step 5: real payments in Test mode

Razorpay test credentials (from Razorpay's test-integration documentation; check its test cards page if any are refused):

| Method | What to use | Result |
|---|---|---|
| Card | `4100 2800 0000 1007` (Visa) or `5500 6700 0000 1002` (Mastercard), any CVV, any future expiry | Opens a mock bank page: choose Success or Failure |
| UPI | `success@razorpay` | Payment succeeds |
| UPI | `failure@razorpay` | Payment fails |
| Netbanking and wallets | Pick any bank or wallet | Mock page with Success and Failure buttons |

Run each scenario below and compare with the expected result. The server terminal shows lines starting `[webhook]` and `[payments]`.

| # | Scenario | How | Expected |
|---|---|---|---|
| 1 | Normal success | Pay with `success@razorpay` | Order confirmation page. Server log: `[payments] order ... created ... (source: ...)` and `[webhook] payment.captured evt_...: completed` (the other webhook lines for the same payment show `completed` too). Exactly one order in Admin, stock down by the quantity. Admin payment status Captured |
| 2 | Failure then retry | Choose `failure@razorpay`, then retry in the same window with `success@razorpay` | `[webhook] payment.failed ...: recorded failure`, then success as in 1. Still one order |
| 3 | Window closed | Open the payment window and close it | "Payment was cancelled. No order was placed". No order, stock unchanged |
| 4 | Browser never hears back | Open DevTools, Network, use "Block request URL" with `*razorpay/verify*`, then pay successfully | The page polls the status endpoint for up to 30 seconds, then shows the order. One order only. The log line `[payments] order ... created for pay_... (source: ...)` tells you which path created it: `webhook payment.captured`, `webhook order.paid`, `status check` or `browser verify` |
| 5 | Webhook missed | In the Dashboard disable the webhook (or turn the tunnel off), block the verify call as in 4 and pay | Order still appears, created by the status check (`source: status check`), because the page asks Razorpay directly. Enable the webhook again afterwards |
| 5b | Background job alone | Pay, and the moment payment succeeds close the tab and do not return. Webhook disabled | After about 10 to 15 minutes the log shows `[payments] reconciled order_...: completed` and the order is in Admin |
| 6 | Duplicate delivery | Dashboard, Webhooks, open the webhook's delivery log if your Dashboard shows one, and resend an event. If there is no resend button, repeat the signed request of Step 4 with the same `x-razorpay-event-id` | `duplicate: true`, no second order |
| 7 | Out of stock after payment | Set a product's stock to 1 in Admin. Start paying for it (window open), and in Admin set stock to 0, then finish paying | Message saying the item is out of stock and the payment is refunded. No order. Stock stays 0. Dashboard shows a refund on the payment. Logs: `[payments] pay_... refunded automatically` and `refund.*` webhooks |
| 8 | Refund from the Dashboard | Dashboard, Payments, open a test payment, Refund (full, then try partial on another) | Admin order shows Refunded or Partially refunded and the refunded amount, after the webhook arrives |
| 9 | Price tamper | In DevTools change the request body or the displayed price before paying | Charge is still the database price. The browser never sends a price |
| 10 | Forged verify | In DevTools replay the verify request with the last character of the signature changed | 400 "Payment could not be verified", no order |
| 11 | Two tabs, same cart | Open checkout in two tabs and pay in both | Two separate payments, two orders, stock reduced twice. If stock only covers one, the second is refunded automatically |
| 12 | Secret mismatch | Change one character of `RAZORPAY_WEBHOOK_SECRET` and restart | Real webhooks fail with 400 and log `rejected: missing or invalid signature`. Put it back. This is also the first thing to check when production webhooks fail |

How to confirm webhooks are really working, in order of reliability:

1. Server log: a `[webhook] <event> <id>: <result>` line for each delivery. No line means Razorpay did not reach you.
2. The `webhookevents` collection in MongoDB Atlas: one document per delivery, `status: "processed"`. A `failed` document has `lastError`.
3. Razorpay Dashboard, Webhooks: look at the webhook's entry for delivery status and logs (the exact screen differs between Dashboard versions). Failures show the HTTP status your server returned: 400 means wrong secret, 404 means `RAZORPAY_ENABLED` is not true, 500 means processing failed and Razorpay will retry, a timeout means the server took longer than 5 seconds or was unreachable.
4. The Alert Email you entered gets a message when deliveries keep failing.

What a local test cannot show: real settlement, live card behaviour, and the performance of your production hosting. Do a final real-money test with a small amount after going live (section 12).

---

## 11. Finding payment bugs (playbook)

### Where to look

- Logs. Every payment line starts with `[payments]` or `[webhook]`. Search for these markers, which mean a human should look:
  - `NEEDS ATTENTION`: a payment was taken but turning it into an order failed. It is retried automatically; if the same payment keeps appearing, act.
  - `MISMATCH`: a payment's amount, currency or order did not match the checkout. No order was created. Check the Dashboard.
  - `ORPHAN PAYMENT`: a captured payment tagged as yours has no checkout record. Find it in the Dashboard and refund or fulfil it by hand.
  - `refunded automatically`: an out-of-stock refund happened.
  - `rejected: missing or invalid signature`: someone (or a wrong secret) sent a bad webhook.
- MongoDB collections: `paymentattempts`, `orders`, `webhookevents`.
- Razorpay Dashboard: Payments, Orders, Refunds, Webhooks.

### Symptom guide

| Symptom | Likely cause | Check |
|---|---|---|
| Customer paid, no order after 15 minutes | Webhook not delivered and customer never returned | Look for a `paymentattempts` document with `status: "pending"` and old `createdAt`. The reconcile job tries at 10 minutes, 1, 6, 24 and 72 hours. Customer opening the checkout page repairs it at once |
| Webhooks return 400 | Webhook secret in Dashboard and `.env` differ, or a proxy altered the body | Compare both values character by character. The secret in the Dashboard must equal `RAZORPAY_WEBHOOK_SECRET`, not the key secret |
| Webhooks return 404 | `RAZORPAY_ENABLED` is not exactly `true` | Check the host's environment settings |
| Webhooks return 500 or time out | Database or Razorpay API problem, or a sleeping server (free hosting plans can take over 5 seconds to wake) | Check `webhookevents` for `failed` and `lastError`; Razorpay retries for 24 hours. Use an always-on plan for the backend |
| Webhook shows disabled in the Dashboard | 24 hours of failures | Fix the cause, enable it again, and check the Alert Email. The reconcile job covers the gap for up to 5 days |
| Orders missing but payments exist in the Dashboard | Webhook and verify both failing | Search logs for `NEEDS ATTENTION` and `MISMATCH`. The payments listed there are the ones to check |
| Two orders for one payment | Should be impossible | The unique index on `razorpayPaymentId` blocks it. If it ever happens, confirm the index exists in Atlas |
| Stock lower than expected | A crash between taking stock and saving the flag, or abandoned checkouts | Stock is only taken after payment. Compare stock with orders |
| "Payment gateway is unavailable" | Razorpay API unreachable or keys wrong | Log line `Razorpay ... failed (status): reason`. A 401 means wrong key id or secret |
| Customer sees "still confirming" | Verify did not complete and the order is not ready yet | Wait a minute and open Your orders. It resolves itself through the webhook or the status check |
| Admin shows Captured on a refunded order | Refund webhooks not subscribed or not delivered | Check the webhook has the three `refund.*` events ticked. A delivery for the payment will correct it |

### Routine reconciliation

Once a week (daily in the first month): in the Dashboard, export captured payments for the period and compare the count and total with Razorpay orders in Admin. Any difference is either a refund (expected), an `ORPHAN PAYMENT` or a payment the system is still retrying.

A useful query on `paymentattempts` (MongoDB shell or Atlas): checkouts with a payment that never finished.

```
{ razorpayPaymentId: { $exists: true }, status: { $in: ["pending", "processing"] } }
```

Anything older than an hour matching this is worth a look.

---

## 12. Going live checklist

1. Razorpay account activated for Live mode.
2. Live keys generated. Live webhook created with the production URL, Live secret and the seven events.
3. Environment variables set in the hosting provider's settings, never in files in the repository: `NODE_ENV=production`, `RAZORPAY_ENABLED=true`, Live `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, plus `CLIENT_ORIGIN` set to your storefront address. In the storefront's host set `VITE_API_URL` to the backend address.
4. `.env` is listed in `.gitignore` (it already is). Confirm no key was ever committed. If one was, regenerate it.
5. The backend runs on an always-on plan so webhooks answer within 5 seconds.
6. HTTPS everywhere.
7. MongoDB Atlas allows the backend host's address.
8. Your Terms, Shipping and Returns policy text states the refund process and timing (this is shown to customers and Razorpay reviews it).
9. Place one real order of a small amount, check: order in Admin, Dashboard payment captured, webhook delivered (log line), then refund it from the Dashboard and confirm Admin shows Refunded.
10. Rotating the webhook secret: edit it in the Dashboard and the host's settings at the same time. Retries of events sent before the change fail the check; the reconcile job and customer status checks cover them.

---

## 13. Limits of this implementation

- Disputes and chargebacks (`payment.dispute.*` events) are not handled automatically. Respond to them in the Dashboard.
- There is no refund button in Admin. Refund from the Razorpay Dashboard; the webhook updates the order.
- Cancelling an order in Admin returns stock but does not refund money. Refund in the Dashboard as a separate step.
- A refunded order keeps its delivery status until you cancel it.
- No payment emails are sent (the project has no email system).
- Currency is INR only.
- Orders created before this change keep their old fields and show as Captured.
- Automated tests are not included, as you asked.

---

## 14. What was verified, and what was not

Verified:

- Every server file passes a syntax check, and the client builds with the production build.
- A temporary harness (kept outside your project, not included) ran the real routes and the real payment code against an in-memory stand-in for the database and a stand-in for Razorpay. It confirmed: forged, missing, malformed and tampered webhook signatures are rejected; webhook first, verify first, and four deliveries at once all produce exactly one order and one stock deduction; duplicate events are skipped; authorized payments are captured; out-of-stock after payment refunds exactly once, and an authorized payment is never captured; wrong amount, wrong order and failed payments never create an order; refund events update the order status; failures roll stock back and the retry succeeds; a crashed worker's claim is taken over without taking stock twice; the status endpoint and the reconcile job repair a missed webhook; ids that are objects, other users' tokens, bad sizes and bad product ids are refused.

Not verified (could not be done in this environment, so do these in your Test-mode run in section 10):

- Calls to the real Razorpay servers and the exact shape of every real webhook payload. The code reads only ids from webhook payloads and takes everything else from Razorpay's API to limit this risk.
- Behaviour against a real MongoDB server (index creation, query behaviour). The queries used are standard.
- The Razorpay Checkout window and the Dashboard screens, whose layout may differ slightly from the descriptions here.

Razorpay documentation used: [Webhook setup](https://razorpay.com/docs/webhooks/setup-edit-payments/), [Validate and test webhooks](https://razorpay.com/docs/webhooks/validate-test), [Webhook best practices](https://razorpay.com/docs/webhooks/best-practices/), [Payment capture settings](https://razorpay.com/docs/payments/payments/capture-settings/), [Test integration (cards, UPI, netbanking)](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/chargeback/test-integration.md).

## 15. Manual Test-Mode Run

The operator reports that all of the following manual payment checks were completed in Test Mode, following the procedures in section 10:

- [x] Successful payment
- [x] Failed payment followed by retry
- [x] Checkout cancellation
- [x] Browser verification blocked
- [x] Missed webhook
- [x] Status recovery and reconciliation
- [x] Duplicate webhook delivery
- [x] Out-of-stock automatic refund
- [x] Refund initiated from the Razorpay Dashboard
- [x] Tampered-price request
- [x] Forged verification signature
- [x] Two-tab/concurrent checkout
- [x] Webhook secret mismatch

This records the operator-reported manual run; it is not an automated test suite. Live-mode payments and production deployment behavior are not covered by this checklist.
