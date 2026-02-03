#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { STAGES } from '../lib/constants/stages';
import { StorageStack } from '../lib/stacks/storage-stack';
import { IdentityStack } from '../lib/stacks/identity-stack';
import { SecretsStack } from '../lib/stacks/secrets-stack';
import { ServiceStack } from '../lib/stacks/service-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';

const app = new App();

STAGES.forEach((stage) => {
  const secretsStack = new SecretsStack(app, `SecretsStack-${stage.name}-${stage.env.region}`, {
    env: stage.env,
  });

  const identityStack = new IdentityStack(app, `IdentityStack-${stage.name}-${stage.env.region}`, {
    env: stage.env,
    userPoolId: stage.userPoolId,

    userPoolClientId: stage.userPoolClientId,
    stageName: stage.name,
  });

  const storageStack = new StorageStack(app, `StorageStack-${stage.name}-${stage.env.region}`, {
    env: stage.env,
  });

  const serviceStack = new ServiceStack(app, `ServiceStack-${stage.name}-${stage.env.region}`, {
    env: stage.env,
    membersAuthorizer: identityStack.membersAuthorizer, // if you have one
    userPool: identityStack.userPool,
    stripeSecret: secretsStack.stripeSecret,
    supabaseSecret: secretsStack.supabaseSecret,
    membersTableArn: stage.membersTableArn,
    configTableArn: stage.configTableArn,
  });
  
  const databaseStack = new DatabaseStack(app, `DatabaseStack-${stage.name}-${stage.env.region}`, {
    env: stage.env,
  });
});
