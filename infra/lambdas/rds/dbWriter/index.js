import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import pg from "pg";

const sm = new SecretsManagerClient({});
const { Client } = pg;

let cachedCreds = null;

async function getCreds() {
  if (cachedCreds) return cachedCreds;
  const arn = process.env.DB_SECRET_ARN;
  if (!arn) throw new Error("Missing DB_SECRET_ARN");
  const resp = await sm.send(new GetSecretValueCommand({ SecretId: arn }));
  const secret = JSON.parse(resp.SecretString);
  cachedCreds = secret;
  return secret;
}

export const handler = async (event) => {
  const host = process.env.HOST;
  const port = Number(process.env.PORT ?? "5432");
  if (!host) throw new Error("Missing HOST");

  const creds = await getCreds();

  const client = new Client({
    host,
    port,
    user: creds.username,
    password: creds.password,
    database: creds.dbname ?? "sdkb-db",
    ssl: false, 
  });

  await client.connect();

  try {
    for (const record of event.Records ?? []) {
      const msg = JSON.parse(record.body);
      const sql = msg.sql;
      const params = msg.params ?? [];

      await client.query(sql, params);
    }
  } finally {
    await client.end();
  }

  return { ok: true, processed: (event.Records ?? []).length };
};
