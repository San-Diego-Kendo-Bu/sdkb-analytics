import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Import existing bucket
    const siteBucket = s3.Bucket.fromBucketName(this, 'ExistingBucket', 'nafudakake');

    // Import existing user pool and app client
    const userPool = UserPool.fromUserPoolId(this, 'UserPool', 'us-east-2_pOKlRyKnT');
    const userPoolClient = UserPoolClient.fromUserPoolClientId(this, 'UserPoolClient', '7uqje135h2m1tu0t1j2bdasgq3');

    const authorizer = new HttpUserPoolAuthorizer('MyCognitoAuth', userPool, {
      userPoolClients: [userPoolClient],
    });

    // Deploy frontend/index.html to the bucket
    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../frontend'))],
      destinationBucket: siteBucket,
    });

    // Lambda functions
    const createMemberLambda = new lambda.Function(this, 'CreateMemberLambda', {
      functionName: 'createMemberCDK',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/createMember')),
    });

    const getMembersLambda = new lambda.Function(this, 'GetMembersLambda', {
      functionName: 'getMembersCDK',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/getMembers')),
    });

    const removeMemberLambda = new lambda.Function(this, 'RemoveMemberLambda', {
      functionName: 'removeMemberCDK',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/removeMember')),
    });

    const modifyMemberLambda = new lambda.Function(this, 'ModifyMemberLambda', {
      functionName: 'modifyMemberCDK',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/modifyMember')),
    });

    // HTTP API Gateway (v2)
    const httpApi = new apigwv2.HttpApi(this, 'MyHttpApi', {
      apiName: 'membersAPI_CDK',
      corsPreflight: {
        allowHeaders: ['*'],
        exposeHeaders: ['*'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
        ],
        allowOrigins: ['*'],
      },
    });

    // add roles
    getMembersLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:Scan'],
      resources: ['arn:aws:dynamodb:us-east-2:222575804757:table/members'],
    }));

    createMemberLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:PutItem'],
      resources: ['arn:aws:dynamodb:us-east-2:222575804757:table/members'],
    }));

    createMemberLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:UpdateItem'],
      resources: ['arn:aws:dynamodb:us-east-2:222575804757:table/appConfigs'],
    }));

    createMemberLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:Query'],
      resources: [
        'arn:aws:dynamodb:us-east-2:222575804757:table/members',
        'arn:aws:dynamodb:us-east-2:222575804757:table/members/index/dedup_key-index'
      ],
    }));

    removeMemberLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:DeleteItem'],
      resources: ['arn:aws:dynamodb:us-east-2:222575804757:table/members'],
    }));

    modifyMemberLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:UpdateItem'],
      resources: ['arn:aws:dynamodb:us-east-2:222575804757:table/members'],
    }));

    modifyMemberLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['dynamodb:Query'],
      resources: [
        'arn:aws:dynamodb:us-east-2:222575804757:table/members',
        'arn:aws:dynamodb:us-east-2:222575804757:table/members/index/dedup_key-index'
      ],
    }));

    // Add routes
    httpApi.addRoutes({
      path: '/items',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetIntegration', getMembersLambda),
    });

    httpApi.addRoutes({
      path: '/items',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('PostIntegration', createMemberLambda),
      authorizer: authorizer,
    });

    httpApi.addRoutes({
      path: '/items',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new integrations.HttpLambdaIntegration('PatchIntegration', modifyMemberLambda),
      authorizer: authorizer,
    });

    httpApi.addRoutes({
      path: '/items',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new integrations.HttpLambdaIntegration('DeleteIntegration', removeMemberLambda),
      authorizer: authorizer,
    });

    // Output the HTTP API URL
    new CfnOutput(this, 'HttpApiUrl', {
      value: httpApi.apiEndpoint,
    });
  }
}
