import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const createMemberLambda = new lambda.Function(this, 'CreateMemberLambda', {
      functionName: 'createMember',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas/createMember'),
    });

    const getMembersLambda = new lambda.Function(this, 'GetMembersLambda', {
      functionName: 'getMembers',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas/getMembers'),
    });

    const removeMemberLambda = new lambda.Function(this, 'RemoveMemberLambda', {
      functionName: 'removeMember',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas/removeMember'),
    });

    const modifyMemberLambda = new lambda.Function(this, 'ModifyMemberLambda', {
      functionName: 'modifyMember',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../lambdas/modifyMember'),
    });

    // You can now add permissions, API Gateway routes, etc.
  }
}
