import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import crypto from "crypto";

const sqs = new SQSClient({});

export const handler = async (event) => {
  const queueUrl = process.env.QUEUE_URL;
  if (!queueUrl) throw new Error("Missing QUEUE_URL");

  const sql = event?.sql;
  const params = event?.params ?? [];
  const idempotencyKey = event?.idempotencyKey ?? crypto.randomUUID();

  if (!sql || typeof sql !== "string") throw new Error("Missing sql");

  const body = JSON.stringify({
    idempotencyKey,
    sql,
    params,
    meta: event?.meta ?? {},
    ts: new Date().toISOString(),
  });

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: body,
      MessageGroupId: "global",
    })
  );

  return { ok: true, enqueued: true, idempotencyKey };
};
