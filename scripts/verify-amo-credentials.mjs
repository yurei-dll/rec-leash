import { createHmac, randomUUID } from "node:crypto";

const issuer = process.env.AMO_JWT_ISSUER;
const secret = process.env.AMO_JWT_SECRET;

if (!issuer || !secret) {
  throw new Error("AMO_JWT_ISSUER and AMO_JWT_SECRET must both be configured");
}

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const issuedAt = Math.floor(Date.now() / 1000);
const unsignedToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
  iss: issuer,
  jti: randomUUID(),
  iat: issuedAt,
  exp: issuedAt + 60
})}`;
const signature = createHmac("sha256", secret).update(unsignedToken).digest("base64url");
const token = `${unsignedToken}.${signature}`;

const response = await fetch("https://addons.mozilla.org/api/v5/accounts/profile/", {
  headers: { Authorization: `JWT ${token}` }
});

if (!response.ok) {
  throw new Error(`AMO credential verification failed with HTTP ${response.status}`);
}

console.log("AMO credentials authenticated successfully");
