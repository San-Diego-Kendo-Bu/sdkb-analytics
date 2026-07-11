import { Stack, StackProps } from "aws-cdk-lib";
import { ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface SecretsStackProps extends StackProps {}

export class SecretsStack extends Stack {

  public readonly stripeSecret: ISecret;
  public readonly stripeSecret_pk: ISecret;
  public readonly gmailSecret: ISecret;

  constructor(scope: Construct, id: string, props: SecretsStackProps) {
    super(scope, id, props);

    this.stripeSecret = Secret.fromSecretNameV2(
      this, "StripeSecret", "prod/stripe"
    );
    this.stripeSecret_pk = Secret.fromSecretNameV2(
      this, "StripeSecretPK", "prod/stripe"
    );
    this.gmailSecret = Secret.fromSecretNameV2(
      this, "GmailSecret", "club/gmail"
    );
  }
}
