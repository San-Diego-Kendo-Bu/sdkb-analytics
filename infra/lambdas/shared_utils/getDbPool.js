const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

const { Pool } = require("pg");

const secrets = new SecretsManagerClient({});

let pool; // reused across Lambda invocations

async function getDbPool() {
  if (pool) {
    return pool; // reuse existing pool
  }

  console.log("Fetching DB credentials...");

  const adminSecret = await secrets.send(
    new GetSecretValueCommand({ SecretId: process.env.RDS_ARN })
  );
  const admin = JSON.parse(adminSecret.SecretString);

  const credentialsSecret = await secrets.send(
    new GetSecretValueCommand({ SecretId: process.env.CREDENTIALS_ARN })
  );
  const credentials = JSON.parse(credentialsSecret.SecretString);

  console.log("Creating DB pool...");

  pool = new Pool({
    host: admin.host,
    user: credentials.user,
    password: credentials.password,
    database: "sdkb-db",
    port: 5432,

    // optional but recommended
    max: 5,                 // max connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  return pool;
}

async function query(text, params) {
  const dbPool = await getDbPool();
  return dbPool.query(text, params);
}

module.exports = { getDbPool, query };