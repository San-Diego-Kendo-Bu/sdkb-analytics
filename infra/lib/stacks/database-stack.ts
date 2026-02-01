import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as cr from "aws-cdk-lib/custom-resources";
import { RemovalPolicy } from "aws-cdk-lib";
import path from "path";

export interface DatabaseStackProps extends StackProps {}

export class DatabaseStack extends Stack {
  constructor(scope: Construct, id: string, props?: DatabaseStackProps) {
    super(scope, id, props);

    // Use default VPC just to host RDS (you are not creating subnets yourself)
    const vpc = ec2.Vpc.fromLookup(this, "DefaultVpc", { isDefault: true });

    // Security group for RDS
    const securityGroupRds = new ec2.SecurityGroup(this, "SecurityGroupRds", {
      vpc,
      description: "Security Group with RDS",
    });

    securityGroupRds.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5432),
      "Allow Postgres (dev)"
    );

    // RDS PostgreSQL Instance - PUBLIC
    const rdsInstance = new rds.DatabaseInstance(this, "PostgresRds", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      publiclyAccessible: true,
      securityGroups: [securityGroupRds],

      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14_19,
      }),
      port: 5432,
      instanceIdentifier: "sdkb-instance",
      allocatedStorage: 10,
      maxAllocatedStorage: 10,
      deleteAutomatedBackups: true,
      removalPolicy: RemovalPolicy.DESTROY,   // delete only when stack is destroyed
      deletionProtection: false,              // must be false or deletion can be blocked
      backupRetention: Duration.days(0),
      credentials: rds.Credentials.fromUsername("sdkbadmin"),
    });

    // IAM Role for Lambdas + custom resource
    const role = new iam.Role(this, "Role", {
      description: "Role used in the RDS stack",
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("lambda.amazonaws.com")
      ),
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "lambda:InvokeFunction",
          "secretsmanager:GetSecretValue",
          "kms:Decrypt",
        ],
        resources: ["*"],
      })
    );

    // Allow reading the generated admin secret
    rdsInstance.secret?.grantRead(role);

    const region = Stack.of(this).region;

    // Put the correct ARN for each region here
    const credentialsSecretArnByRegion: Record<string, string> = {
    "us-east-2": "arn:aws:secretsmanager:us-east-2:222575804757:secret:rds-db-creds-ZdoyWS",
    "us-west-2": "arn:aws:secretsmanager:us-west-2:222575804757:secret:rds-db-creds-S0vLyA",
    };

    const credentialsSecretArn = credentialsSecretArnByRegion[region];
    if (!credentialsSecretArn) {
    throw new Error(
        `No credentials secret configured for region ${region}. Add it to credentialsSecretArnByRegion.`
    );
    }

    const credentials = secrets.Secret.fromSecretCompleteArn(
    this,
    "CredentialsSecret",
    credentialsSecretArn
    );
    credentials.grantRead(role);

    // Lambda creator - NOT in VPC (fast, no VPC endpoints needed)
    const createResolver = (name: string, entry: string) =>
      new nodejs.NodejsFunction(this, name, {
        entry,
        bundling: {
            externalModules: ["pg-native"],
            commandHooks: {
                beforeInstall() { return []; },
                beforeBundling() { return []; },
                afterBundling(inputDir: string, outputDir: string) {
                    const repoSqlDir = path.resolve(__dirname, "../../sql"); // adjust to your repo
                    return [
                        `mkdir -p "${outputDir}/sql"`,
                        `cp -R "${repoSqlDir}/." "${outputDir}/sql/"`,
                    ];
                },
            },
        },
        runtime: lambda.Runtime.NODEJS_18_X,
        timeout: Duration.minutes(2),
        role,   
        environment: {
          RDS_ARN: rdsInstance.secret!.secretArn,
          CREDENTIALS_ARN: credentials.secretArn,
          HOST: rdsInstance.dbInstanceEndpointAddress,
        },
    });

    const sqlSource = path.resolve(__dirname, "../../../path/to/init.sql");

    // Init lambda
    const instantiate = createResolver(
      "instantiate",
      path.join(__dirname, "../../lambdas/psql/init/index.js")
    );
    instantiate.node.addDependency(rdsInstance);

    // Custom Resource to run init lambda ON CREATE
    const customResource = new cr.AwsCustomResource(this, "TriggerInstantiate", {
      role,
      onCreate: {
        service: "Lambda",
        action: "invoke",
        parameters: {
          FunctionName: instantiate.functionName,
        },
        physicalResourceId: cr.PhysicalResourceId.of("TriggerInstantiate"),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [instantiate.functionArn],
      }),
    });
    customResource.node.addDependency(instantiate);
  }
}
