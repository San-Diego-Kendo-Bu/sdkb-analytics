const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

const { Pool } = require("pg");

const secrets = new SecretsManagerClient({});
let pool;

async function getDbPool() {
  if (pool) {
    return pool;
  }

  const adminSecret = await secrets.send(
    new GetSecretValueCommand({ SecretId: process.env.RDS_ARN })
  );
  const admin = JSON.parse(adminSecret.SecretString);

  const credentialsSecret = await secrets.send(
    new GetSecretValueCommand({ SecretId: process.env.CREDENTIALS_ARN })
  );
  const credentials = JSON.parse(credentialsSecret.SecretString);

  // print out keys for debugging
  console.log("Credentials keys:", Object.keys(credentials));

  const user = credentials.user;
  const password = credentials.password;  
  console.log("credentials keys:", Object.keys(credentials));
  console.log("user:", credentials.user);
  console.log("password length:", credentials["password "]?.length);

  pool = new Pool({
    host: admin.host,
    user: user,
    password: password,
    database: "sdkb-db",
    port: 5432,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on("error", (err) => {
    console.error("Unexpected idle PostgreSQL client error:", err);
  });

  return pool;
}

async function query(text, params) {
  const dbPool = await getDbPool();
  return dbPool.query(text, params);
}

module.exports = { getDbPool, query };