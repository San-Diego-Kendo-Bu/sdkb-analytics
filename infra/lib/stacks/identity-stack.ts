import { Stack, StackProps } from "aws-cdk-lib";
import { IHttpRouteAuthorizer } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export interface IdentityStackProps extends StackProps {
  userPoolId: string;
  userPoolClientId: string;
  stageName: string;
}

export class IdentityStack extends Stack {

  public readonly membersAuthorizer: IHttpRouteAuthorizer;

  constructor(scope: Construct, id: string, props: IdentityStackProps) {
    super(scope, id, props);

    // Import existing user pool and app client
    const userPool = UserPool.fromUserPoolId(this, `UserPool-${props.stageName}`, props.userPoolId);
    const userPoolClient = UserPoolClient.fromUserPoolClientId(this, `UserPoolClient-${props.stageName}`, props.userPoolClientId);

    this.membersAuthorizer = new HttpUserPoolAuthorizer('MembersAuthorizer', userPool, {
      userPoolClients: [userPoolClient],
    });
  }
}
