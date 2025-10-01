import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { IHttpRouteAuthorizer } from "aws-cdk-lib/aws-apigatewayv2";
import { Code, Function, IFunction, Runtime } from "aws-cdk-lib/aws-lambda";
import { LogLevel, NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import path from "path";

export interface ComputeStackProps extends StackProps {
  membersAuthorizer: IHttpRouteAuthorizer;
  stripeSecretName: string;
  supabaseSecretName: string;
}

export interface NafudakakeLambdaFunctions {
  createMemberLambda: IFunction;
  getMembersLambda: IFunction;
  getAdminLambda: IFunction;
  removeMemberLambda: IFunction;
  modifyMemberLambda: IFunction;
  createPaymentLambda: IFunction;
  removePaymentLambda: IFunction;
  updatePaymentLambda: IFunction;
  getPaymentLambda : IFunction;
}

export class ComputeStack extends Stack {

  public readonly lambdaFunctions: NafudakakeLambdaFunctions;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    this.lambdaFunctions = {
      createMemberLambda: new NodejsFunction(this, "CreateMemberLambda", {
        functionName: "CreateMemberLambda",
        entry: path.join(__dirname, "../../lambdas/members/createMember/index.js"),
        handler: "handler",
        runtime: Runtime.NODEJS_18_X,
        timeout: Duration.seconds(10),
        projectRoot: path.join(__dirname, "../../"),
        depsLockFilePath: path.join(__dirname, "../../package-lock.json"),
        bundling: {
          target: "node18",
          format: OutputFormat.CJS,
          externalModules: [],
          minify: true,
          sourceMap: true,
          logLevel: LogLevel.DEBUG,
        },
        environment: {
          SECRET_ID: props.stripeSecretName,
        },
      }),
      getMembersLambda: new Function(this, 'GetMembersLambda', {
        functionName: 'GetMembersLambda',
        runtime: Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: Code.fromAsset(path.join(__dirname, '../../lambdas/members/getMembers')),
      }),
      getAdminLambda: new Function(this, 'GetAdminLambda', {
        functionName: 'GetAdminLambda',
        runtime: Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: Code.fromAsset(path.join(__dirname, '../../lambdas/admins/getAdmin')),
      }),
      removeMemberLambda: new NodejsFunction(this, "RemoveMemberLambda", {
        functionName: "RemoveMemberLambda",
        entry: path.join(__dirname, "../../lambdas/members/removeMember/index.js"),
        handler: "handler",
        runtime: Runtime.NODEJS_18_X,
        timeout: Duration.seconds(10),

        projectRoot: path.join(__dirname, "../../"),
        depsLockFilePath: path.join(__dirname, "../../package-lock.json"),

        bundling: {
          target: "node18",
          format: OutputFormat.CJS,
          externalModules: [],
          minify: true,
          sourceMap: true,
          logLevel: LogLevel.DEBUG,
        },

        environment: {
          SECRET_ID: props.stripeSecretName,
        },
      }),
      modifyMemberLambda: new Function(this, 'ModifyMemberLambda', {
        functionName: 'ModifyMemberLambda',
        runtime: Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: Code.fromAsset(path.join(__dirname, '../../lambdas/members/modifyMember')),
      }),
      createPaymentLambda: new NodejsFunction(this, "CreatePaymentLambda", {
        functionName: "CreatePaymentLambda",
        entry: path.join(__dirname, "../../lambdas/payments/createPayment/index.js"),
        handler: "handler",
        runtime: Runtime.NODEJS_18_X,
        timeout: Duration.seconds(10),
        projectRoot: path.join(__dirname, "../../"),
        depsLockFilePath: path.join(__dirname, "../../package-lock.json"),
        bundling: {
          target: "node18",
          format: OutputFormat.CJS,
          externalModules: [],
          minify: true,
          sourceMap: true,
          logLevel: LogLevel.DEBUG,
        },
        environment: {
          SUPABASE_SECRET_ID: props.supabaseSecretName,
        },
      }),
      removePaymentLambda: new NodejsFunction(this, "RemovePaymentLambda", {
        functionName: "RemovePaymentLambda",
        entry: path.join(__dirname, "../../lambdas/payments/removePayment/index.js"),
        handler: "handler",
        runtime: Runtime.NODEJS_18_X,
        timeout: Duration.seconds(10),
        projectRoot: path.join(__dirname, "../../"),
        depsLockFilePath: path.join(__dirname, "../../package-lock.json"),
        bundling: {
          target: "node18",
          format: OutputFormat.CJS,
          externalModules: [],
          minify: true,
          sourceMap: true,
          logLevel: LogLevel.DEBUG,
        },
        environment: {
          SUPABASE_SECRET_ID: props.supabaseSecretName,
        },
      }),
      updatePaymentLambda: new NodejsFunction(this, "UpdatePaymentLambda", {
        functionName: "UpdatePaymentLambda",
        entry: path.join(__dirname, "../../lambdas/payments/updatePayment/index.js"),
        handler: "handler",
        runtime: Runtime.NODEJS_18_X,
        timeout: Duration.seconds(10),
        projectRoot: path.join(__dirname, "../../"),
        depsLockFilePath: path.join(__dirname, "../../package-lock.json"),
        bundling: {
          target: "node18",
          format: OutputFormat.CJS,
          externalModules: [],
          minify: true,
          sourceMap: true,
          logLevel: LogLevel.DEBUG,
        },
        environment: {
          SUPABASE_SECRET_ID: props.supabaseSecretName,
        },
      }),
      getPaymentLambda: new NodejsFunction(this, "GetPaymentLambda", {
        functionName: "GetPaymentLambda",
        entry: path.join(__dirname, "../../lambdas/payments/getPayment/index.js"),
        handler: "handler",
        runtime: Runtime.NODEJS_18_X,
        timeout: Duration.seconds(10),
        projectRoot: path.join(__dirname, "../../"),
        depsLockFilePath: path.join(__dirname, "../../package-lock.json"),
        bundling: {
          target: "node18",
          format: OutputFormat.CJS,
          externalModules: [],
          minify: true,
          sourceMap: true,
          logLevel: LogLevel.DEBUG,
        },
        environment: {
          ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcmlpaWN2dnh6dmlkYWFrY3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDg0MjUsImV4cCI6MjA3MDcyNDQyNX0.GtHJ405NZAA8V2RQy1h6kz3wIrdraaOEXTKTentoePE',
        },
      })
    }
  }
}
