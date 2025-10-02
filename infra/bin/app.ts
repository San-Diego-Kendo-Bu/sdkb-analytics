#!/usr/bin/env node
import { ComputeStack } from '../lib/stacks/compute-stack';
import { App } from 'aws-cdk-lib';
import { STAGES } from '../lib/constants/stages';
import { StorageStack } from '../lib/stacks/storage-stack';
import { IamStack } from '../lib/stacks/iam-stack';
import { IdentityStack } from '../lib/stacks/identity-stack';
import { InputStack } from '../lib/stacks/input-stack';
import { SecretsStack } from '../lib/stacks/secrets-stack';

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

  const computeStack = new ComputeStack(app, `ComputeStack-${stage.name}-${stage.env.region}`, {
    env: stage.env,
    membersAuthorizer: identityStack.membersAuthorizer,
    stripeSecretName: secretsStack.stripeSecret.secretName,
    supabaseSecretName: secretsStack.supabaseSecret.secretName
  });

  const storageStack = new StorageStack(app, `StorageStack-${stage.name}-${stage.env.region}`, {
    env: stage.env,
  });

  const iamStack = new IamStack(app, `IamStack-${stage.name}-${stage.env.region}`, {
    env: stage.env,
    stripeSecret: secretsStack.stripeSecret,
    supabaseSecret: secretsStack.supabaseSecret,
    lambdaFunctions: computeStack.lambdaFunctions,
    membersTableArn: stage.membersTableArn,
    configTableArn: stage.configTableArn,
  });
  
  const inputStack = new InputStack(app, `InputStack-${stage.name}-${stage.env.region}`, {
    env: stage.env,
    membersAuthorizer: identityStack.membersAuthorizer,
    lambdaFunctions: computeStack.lambdaFunctions,
  });
});
