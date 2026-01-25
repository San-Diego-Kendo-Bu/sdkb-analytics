import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cr from 'aws-cdk-lib/custom-resources';
import path from "path";

export interface DatabaseStackProps extends StackProps { }

export class DatabaseStack extends Stack {
    constructor(scope: Construct, id: string, props?: DatabaseStackProps) {
        super(scope, id, props);

        // VPC for RDS and Lambda resolvers
        const vpc = new ec2.Vpc(this, 'VPC', {
            maxAzs: 2,
            natGateways: 0,
            subnetConfiguration: [
                {
                subnetType: ec2.SubnetType.PUBLIC,
                cidrMask: 24,
                name: 'public'
                },
                {
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24,
                    name: 'rds'
                }
            ]
        })

        // Security Groups
        const securityGroupResolvers = new ec2.SecurityGroup(this, 'SecurityGroupResolvers', {
            vpc,
            description: 'Security Group with Resolvers',
        })
        const securityGroupRds = new ec2.SecurityGroup(this, 'SecurityGroupRds', {
            vpc,
            description: 'Security Group with RDS',
        })

        // Ingress and Egress Rules
        securityGroupRds.addIngressRule(
            securityGroupResolvers,
            ec2.Port.tcp(5432),
            'Allow inbound traffic to RDS'
        )

        // VPC Interfaces
        vpc.addInterfaceEndpoint('LAMBDA', {
            service: ec2.InterfaceVpcEndpointAwsService.LAMBDA,
            subnets: { subnets: vpc.isolatedSubnets },
            securityGroups: [securityGroupResolvers],
        })
        vpc.addInterfaceEndpoint('SECRETS_MANAGER', {
            service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
            subnets: { subnets: vpc.isolatedSubnets },
            securityGroups: [securityGroupResolvers],
        })

        // IAM Role
        const role = new iam.Role(this, 'Role', {
            description: 'Role used in the RDS stack',
            assumedBy: new iam.CompositePrincipal(
                new iam.ServicePrincipal('ec2.amazonaws.com'),
                new iam.ServicePrincipal('lambda.amazonaws.com'),
            )
        })
        role.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'cloudwatch:PutMetricData',
                    "ec2:CreateNetworkInterface",
                    "ec2:DescribeNetworkInterfaces",
                    "ec2:DeleteNetworkInterface",
                    "ec2:DescribeInstances",
                    "ec2:DescribeSubnets",
                    "ec2:DescribeSecurityGroups",
                    "ec2:DescribeRouteTables",
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                    'lambda:InvokeFunction',
                    'secretsmanager:GetSecretValue',
                    'kms:decrypt',
                    'rds-db:connect'
                ],
                resources: ['*']
            })
        )

        // RDS PostgreSQL Instance
        const rdsInstance = new rds.DatabaseInstance(this, 'PostgresRds', {
            vpc,
            securityGroups: [securityGroupRds],
            vpcSubnets: { subnets: vpc.isolatedSubnets },
            availabilityZone: vpc.isolatedSubnets[0].availabilityZone,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
            engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_14_19 }),
            port: 5432,
            instanceIdentifier: 'sdkb-instance',
            allocatedStorage: 10,
            maxAllocatedStorage: 10,
            deleteAutomatedBackups: true,
            backupRetention: Duration.millis(0),
            credentials: rds.Credentials.fromUsername('sdkbadmin'),
            publiclyAccessible: false
        })
        rdsInstance.secret?.grantRead(role)

        // Secrets for database credentials.
        const credentials = secrets.Secret.fromSecretCompleteArn(this, 'CredentialsSecret', 'arn:aws:secretsmanager:us-east-2:222575804757:secret:rds-db-creds-ZdoyWS')
        credentials.grantRead(role)

        // Returns function to connect with RDS instance.
        const createResolver = (name: string, entry: string) => new nodejs.NodejsFunction(this, name, {
            entry: entry,
            bundling: {
                externalModules: ['pg-native']
            },
            runtime: lambda.Runtime.NODEJS_18_X,
            timeout: Duration.minutes(2),
            role,
            vpc,
            vpcSubnets: { subnets: vpc.isolatedSubnets },
            securityGroups: [securityGroupResolvers],
            environment: {
                RDS_ARN: rdsInstance.secret!.secretArn,
                CREDENTIALS_ARN: credentials.secretArn,
                HOST: rdsInstance.dbInstanceEndpointAddress
            }
        })

        // Instantiate new db with user and permissions also add table.
        const instantiate = createResolver('instantiate', path.join(__dirname, '../../lambdas/psql/init/index.js'));
        instantiate.node.addDependency(rdsInstance);

        // const deleteItem = createResolver('delete-item', '../../lambdas/psql/delete/index.js');
        // deleteItem.node.addDependency(rdsInstance);

        // const insertItem = createResolver('insert-item', '../../lambdas/psql/insert/index.js');
        // insertItem.node.addDependency(rdsInstance);

        // const selectItems = createResolver('select-item', '../../lambdas/psql/select/index.js');
        // selectItems.node.addDependency(rdsInstance);

        // Custom Resource to execute instantiate function.
        const customResource = new cr.AwsCustomResource(this, 'TriggerInstantiate', {
            functionName: 'trigger-instantiate',
            role,
            onCreate: {
                service: 'Lambda',
                action: 'invoke',
                parameters: {
                    FunctionName: instantiate.functionName,
                },
                physicalResourceId: cr.PhysicalResourceId.of('TriggerInstantiate'),
            },
            policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
                resources: [instantiate.functionArn],
            }),
        });
        customResource.node.addDependency(instantiate)
    }
}