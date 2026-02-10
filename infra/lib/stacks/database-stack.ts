import { Duration, Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as cr from "aws-cdk-lib/custom-resources";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import path from "path";
import { NodejsFunction, LogLevel, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import {
  Runtime
} from "aws-cdk-lib/aws-lambda";

export interface DatabaseStackProps extends StackProps {}

export class DatabaseStack extends Stack {
  constructor(scope: Construct, id: string, props?: DatabaseStackProps) {
    super(scope, id, props);

    // ===== SQS (write buffer) =====
    const dbOpsDlq = new sqs.Queue(this, "DbOpsDlq", {
      retentionPeriod: Duration.days(14),
      fifo: true,
      queueName: "db-ops-dlq.fifo",
      contentBasedDeduplication: true,
    });

    const dbOpsQueue = new sqs.Queue(this, "DbOpsQueue", {
      visibilityTimeout: Duration.minutes(2),
      deadLetterQueue: { queue: dbOpsDlq, maxReceiveCount: 5 },

      fifo: true,
      queueName: "db-ops.fifo",
      contentBasedDeduplication: true,
    });

    const commonNodejs = {
      runtime: Runtime.NODEJS_18_X,
      timeout: Duration.seconds(10),
      projectRoot: path.join(__dirname, "../../"),
      depsLockFilePath: path.join(__dirname, "../../package-lock.json"),
      bundling: {
        target: "node18",
        format: OutputFormat.CJS,
        externalModules: [] as string[],
        minify: true,
        sourceMap: true,
        logLevel: LogLevel.DEBUG,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    };

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

    // RDS Public PostgreSQL Instance
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

    // ===== Consumer: dequeues + writes to Postgres =====
    const dbWriterLambda = new NodejsFunction(this, "DbWriterLambda", {
      entry: path.join(__dirname, "../../lambdas/rds/dbWriter/index.js"),
      handler: "handler",
      ...commonNodejs,
      timeout: Duration.seconds(30),
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        HOST: rdsInstance.dbInstanceEndpointAddress,
        DB_SECRET_ARN: rdsInstance.secret!.secretArn,
        PORT: "5432",
      },
    });

    // Create the event source mapping explicitly so we can enable/disable it
    const mapping = new lambda.EventSourceMapping(this, "DbWriterMapping", {
      target: dbWriterLambda,
      eventSourceArn: dbOpsQueue.queueArn,
      batchSize: 5,
      enabled: true,
    });

    // Allow Lambda service to consume from the queue (CDK handles some of this, but explicit is fine)
    dbOpsQueue.grantConsumeMessages(dbWriterLambda);

    // ===== Producer: other lambdas invoke this to enqueue SQL work =====
    const enqueueSqlLambda = new NodejsFunction(this, "EnqueueSqlLambda", {
      entry: path.join(__dirname, "../../lambdas/rds/enqueueSql/index.js"),
      handler: "handler",
      ...commonNodejs,
      timeout: Duration.seconds(10),
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        QUEUE_URL: dbOpsQueue.queueUrl,
      },
    });
    dbOpsQueue.grantSendMessages(enqueueSqlLambda);

    // allow dbWriter to read creds
    rdsInstance.secret!.grantRead(dbWriterLambda);

    // shutdown logic
    const controlDbLambda = new NodejsFunction(this, "ControlDbLambda", {
      entry: path.join(__dirname, "../../lambdas/rds/controlDb/index.js"),
      handler: "handler",
      ...commonNodejs, // or whatever you called it
      environment: {          
        DB_INSTANCE_ID: rdsInstance.instanceIdentifier, // pass this in from your stack props
      },
      timeout: Duration.seconds(30),
      runtime: lambda.Runtime.NODEJS_18_X,
    });

    // Permissions for Lambda to start/stop THIS DB
    controlDbLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["rds:StartDBInstance", "rds:StopDBInstance", "rds:DescribeDBInstances"],
        resources: [rdsInstance.instanceArn], // RDS instance ARNs can be tricky w/ imported attrs; "*" is common here
      })
    );

    // Role that EventBridge Scheduler uses to invoke the Lambda
    const schedulerRole = new iam.Role(this, "SchedulerInvokeRole", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    });
    schedulerRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["lambda:InvokeFunction"],
        resources: [controlDbLambda.functionArn],
      })
    );

    // 2) Schedule STOP at 12:00 AM America/Los_Angeles
    new scheduler.CfnSchedule(this, "StopAtMidnightPT", {
      flexibleTimeWindow: { mode: "OFF" },
      scheduleExpression: "cron(0 0 * * ? *)", // 00:00 every day
      scheduleExpressionTimezone: "America/Los_Angeles",
      target: {
        arn: controlDbLambda.functionArn,
        roleArn: schedulerRole.roleArn,
        input: JSON.stringify({ action: "stop" }),
      },
    });

    // 3) Schedule START at 7:00 AM America/Los_Angeles
    new scheduler.CfnSchedule(this, "StartAtSevenPT", {
      flexibleTimeWindow: { mode: "OFF" },
      scheduleExpression: "cron(0 7 * * ? *)", // 07:00 every day
      scheduleExpressionTimezone: "America/Los_Angeles",
      target: {
        arn: controlDbLambda.functionArn,
        roleArn: schedulerRole.roleArn,
        input: JSON.stringify({ action: "start" }),
      },
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
                    const repoSqlDir = path.resolve(__dirname, "../../sql");
                    const sqlOutDir = path.join(outputDir, "sql");
                    const isWindows = process.platform === "win32";
                    
                    if (isWindows) {
                        return [
                            `if not exist "${sqlOutDir}" mkdir "${sqlOutDir}"`,
                            `xcopy /E /I /Y "${repoSqlDir}" "${sqlOutDir}"`,
                        ];
                    } else {
                        return [
                            `mkdir -p "${sqlOutDir}"`,
                            `cp -R "${repoSqlDir}/." "${sqlOutDir}/"`,
                        ];
                    }
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
