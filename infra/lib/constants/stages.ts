import { Environment } from "aws-cdk-lib";

export interface Stage {
  name: string;
  env: Environment;
  membersTableArn: string;
  configTableArn: string;
  userPoolId: string;
  userPoolClientId: string;
}

const ALPHA: Stage = {
  name: 'alpha',
  env: {
    account: '222575804757',
    region: 'us-west-2',
  },
  membersTableArn: 'arn:aws:dynamodb:us-west-2:222575804757:table/members',
  configTableArn: 'arn:aws:dynamodb:us-west-2:222575804757:table/appConfigs',
  userPoolId: 'us-west-2_vzaw67ddt',
  userPoolClientId: '16jp8lcjkdia9d0a640jkgch76',
}

const BETA: Stage = {
  name: 'beta',
  env: {
    account: '222575804757',
    region: 'us-east-2',
  },
  membersTableArn: 'arn:aws:dynamodb:us-east-2:222575804757:table/members',
  configTableArn: 'arn:aws:dynamodb:us-east-2:222575804757:table/appConfigs',
  userPoolId: 'us-east-2_pOKlRyKnT',
  userPoolClientId: '7uqje135h2m1tu0t1j2bdasgq3',
}

export const STAGES = [ALPHA, BETA];
