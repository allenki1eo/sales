# East African Spirit Sales

## Single sign-on from IMS

IMS can send an already-authenticated user straight into this app. No second password is asked when the launch token is valid and a Sales user matches.

### Configuration

Set the same secret in both apps:

| App | Variable |
| --- | --- |
| Sales | `SSO_SHARED_SECRET` |
| IMS | `SSO_SHARED_SECRET` |

Generate one with `openssl rand -base64 32`. This secret is only for launch tokens. `SALES_WEBHOOK_SECRET` and `IMS_BASE_URL` stay as they are and are only used for order and KPI webhooks.

`NEXTAUTH_SECRET` and `NEXTAUTH_URL` are still required. Password sign-in on `/login` is unchanged.

### Launch URL

```
GET {SALES_APP_URL}/api/sso/callback?token={jwt}
```

Example: `https://sales.eastafricanspirit.co.tz/api/sso/callback?token=...`

The token is a credential. Do not log the callback URL.

### Token

HS256 JWT signed with `SSO_SHARED_SECRET`.

| Claim | Required | Notes |
| --- | --- | --- |
| `sub` | yes | IMS user id |
| `aud` | yes | Must be the string `sales` |
| `email` | one of email or username | Matched first, case-insensitively, against `users.username` |
| `username` | one of email or username | Matched second, case-insensitively, against `users.username` |
| `name` | no | Full name, used only when a new Sales user is created |
| `jti` | yes | Unique id. Each value is accepted once |
| `iat`, `exp` | yes | Lifetime (`exp - iat`) must be at most 120 seconds |

A bad audience, a bad signature, an expired token, or a reused `jti` is rejected. The browser sees a short error page and can still use `/login`.

### Which Sales user is signed in

Sales has no separate email column. `users.username` is the login name.

1. If `email` equals a username, that user is used.
2. Otherwise if `username` equals a username, that user is used.
3. Otherwise a `sales_officer` user is created. That is the schema default and the least-privileged role. The password is random, so the credentials form cannot be used for that account until an admin deletes it and creates one with a known password.

An existing user's role and password are left as they are. SSO does not grant `admin` or `accountant`. Create those accounts in the Sales admin screen first, with the username set to the IMS email or the IMS username, so the launch matches them.

### Try a token locally

With `SSO_SHARED_SECRET` set in the environment (do not print it):

```bash
node --input-type=module -e '
import crypto from "crypto";
const secret = process.env.SSO_SHARED_SECRET;
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const header = b64({ alg: "HS256", typ: "JWT" });
const payload = b64({
  sub: "ims-user-id",
  email: "loreen@example.com",
  username: "Loreen",
  name: "Loreen Tarimo",
  aud: "sales",
  jti: crypto.randomUUID(),
  iat: now,
  exp: now + 90,
});
const data = `${header}.${payload}`;
const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
console.log(`${data}.${sig}`);
'
```

Open `/api/sso/callback?token=` plus that value, or launch Sales from IMS once the IMS side is sending this token. A matching user lands on `/dashboard` with a normal NextAuth session.
