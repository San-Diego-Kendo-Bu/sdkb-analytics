import { Stack, StackProps } from "aws-cdk-lib";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { NafudakakeLambdaFunctions } from "./compute-stack";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

export interface IamStackProps extends StackProps {
  stripeSecret: ISecret;
  supabaseSecret: ISecret;
  lambdaFunctions: NafudakakeLambdaFunctions;
  membersTableArn: string;
  configTableArn: string;
}

export class IamStack extends Stack {
  constructor(scope: Construct, id: string, props: IamStackProps) {
    super(scope, id, props);

    // Grant read permissions to the member creation Lambda
    props.stripeSecret.grantRead(props.lambdaFunctions.createMemberLambda);
    props.supabaseSecret.grantRead(props.lambdaFunctions.createPaymentLambda);
    props.supabaseSecret.grantRead(props.lambdaFunctions.removePaymentLambda);
    props.supabaseSecret.grantRead(props.lambdaFunctions.updatePaymentLambda);

    // add roles
    props.lambdaFunctions.getMembersLambda.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['dynamodb:Scan'],
      resources: [props.membersTableArn],
    }));

    props.lambdaFunctions.getMembersLambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['dynamodb:Query'],
      resources: [
        props.membersTableArn,
        `${props.membersTableArn}/index/email-index`,
      ],
    }));

    props.lambdaFunctions.createMemberLambda.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['dynamodb:PutItem'],
      resources: [props.membersTableArn],
    }));

    props.lambdaFunctions.createMemberLambda.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['dynamodb:UpdateItem'],
      resources: [props.configTableArn],
    }));

    props.lambdaFunctions.createMemberLambda.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['dynamodb:Query'],
      resources: [
        props.membersTableArn,
        `${props.membersTableArn}/index/dedup_key-index`
      ],
    }));

    props.lambdaFunctions.removeMemberLambda.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['dynamodb:DeleteItem'],
      resources: [props.membersTableArn],
    }));

    props.lambdaFunctions.modifyMemberLambda.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['dynamodb:UpdateItem'],
      resources: [props.membersTableArn],
    }));

    props.lambdaFunctions.modifyMemberLambda.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['dynamodb:Query'],
      resources: [
        props.membersTableArn,
        `${props.membersTableArn}/index/dedup_key-index`
      ],
    }));

    props.lambdaFunctions.createPaymentLambda.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['dynamodb:UpdateItem'],
      resources: [props.configTableArn],
    }));

  }
}
