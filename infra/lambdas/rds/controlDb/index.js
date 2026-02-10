import { RDSClient, StartDBInstanceCommand, StopDBInstanceCommand } from "@aws-sdk/client-rds";

const client = new RDSClient({});

export const handler = async (event) => {
  const dbId = process.env.DB_INSTANCE_ID;
  const action = event?.action;

  if (!dbId) throw new Error("Missing DB_INSTANCE_ID env var");
  if (action !== "start" && action !== "stop") {
    throw new Error(`Invalid action. Expected "start" or "stop", got: ${action}`);
  }

  if (action === "stop") {
    await client.send(new StopDBInstanceCommand({ DBInstanceIdentifier: dbId }));
  } else {
    await client.send(new StartDBInstanceCommand({ DBInstanceIdentifier: dbId }));
  }

  return { ok: true, action, dbId };
};
