// service-stack.ts
import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import path from "path";

import {
  HttpApi,
  CorsHttpMethod,
  HttpMethod,
  IHttpRouteAuthorizer,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";

import {
  Runtime,
  Code,
  Function as LambdaFunction,
} from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, LogLevel, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";

export interface ServiceStackProps extends StackProps {
  membersAuthorizer?: IHttpRouteAuthorizer;   // attach to protected routes if provided
  stripeSecret: ISecret;
  supabaseSecret: ISecret;
  membersTableArn: string;
  configTableArn: string;
}

export class ServiceStack extends Stack {
  public readonly httpApiUrl: string;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    // ---- Common NodeJS bundling/options
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

    // ---- Lambdas
    const createMemberLambda = new NodejsFunction(this, "CreateMemberLambda", {
      entry: path.join(__dirname, "../../lambdas/members/createMember/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SECRET_ID: props.stripeSecret.secretName },
    });

    const getMembersLambda = new LambdaFunction(this, "GetMembersLambda", {
      runtime: Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: Code.fromAsset(path.join(__dirname, "../../lambdas/members/getMembers")),
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const getAdminLambda = new LambdaFunction(this, "GetAdminLambda", {
      runtime: Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: Code.fromAsset(path.join(__dirname, "../../lambdas/admins/getAdmin")),
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const removeMemberLambda = new NodejsFunction(this, "RemoveMemberLambda", {
      entry: path.join(__dirname, "../../lambdas/members/removeMember/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SECRET_ID: props.stripeSecret.secretName },
    });

    const modifyMemberLambda = new LambdaFunction(this, "ModifyMemberLambda", {
      runtime: Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: Code.fromAsset(path.join(__dirname, "../../lambdas/members/modifyMember")),
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const createPaymentLambda = new NodejsFunction(this, "CreatePaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/payments/createPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });

    const removePaymentLambda = new NodejsFunction(this, "RemovePaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/payments/removePayment/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });

    const updatePaymentLambda = new NodejsFunction(this, "UpdatePaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/payments/updatePayment/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });

    const getPaymentLambda = new NodejsFunction(this, "GetPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/payments/getPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });

    const createEventLambda = new NodejsFunction(this, "CreateEventLambda", {
      entry: path.join(__dirname, "../../lambdas/events/createEvent/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });
    const getEventLambda = new NodejsFunction(this, "GetEventLambda", {
      entry: path.join(__dirname, "../../lambdas/events/getEvents/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });
    const updateEventLambda = new NodejsFunction(this, "UpdateEventLambda", {
      entry: path.join(__dirname, "../../lambdas/events/updateEvent/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });
    const removeEventLambda = new NodejsFunction(this, "RemoveEventLambda", {
      entry: path.join(__dirname, "../../lambdas/events/removeEvent/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });

    // ---- Secrets access (same as your IamStack)
    props.stripeSecret.grantRead(createMemberLambda);
    props.stripeSecret.grantRead(removeMemberLambda);

    props.supabaseSecret.grantRead(createPaymentLambda);
    props.supabaseSecret.grantRead(removePaymentLambda);
    props.supabaseSecret.grantRead(updatePaymentLambda);
    props.supabaseSecret.grantRead(getPaymentLambda);

    props.supabaseSecret.grantRead(createEventLambda);
    props.supabaseSecret.grantRead(getEventLambda);
    props.supabaseSecret.grantRead(updateEventLambda);
    props.supabaseSecret.grantRead(removeEventLambda);

    // ---- DynamoDB policies (same as your IamStack)
    const members = props.membersTableArn;
    const config  = props.configTableArn;

    getMembersLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Scan"],
      resources: [members],
    }));
    getMembersLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [members, `${members}/index/email-index`],
    }));

    createMemberLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:PutItem"],
      resources: [members],
    }));
    createMemberLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [config],
    }));
    createMemberLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [members, `${members}/index/dedup_key-index`],
    }));

    removeMemberLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:DeleteItem"],
      resources: [members],
    }));
    removeMemberLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [members],
    }));

    modifyMemberLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [members],
    }));
    modifyMemberLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [members, `${members}/index/dedup_key-index`],
    }));

    createPaymentLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [config],
    }));

    createEventLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [config],
    }));


    // ---- HTTP API + routes
    const httpApi = new HttpApi(this, "ServiceApi", {
      apiName: "MembersApi",
      corsPreflight: {
        allowHeaders: ["*"],
        exposeHeaders: ["*"],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.DELETE,
        ],
        allowOrigins: ["*"],
      },
    });

    const auth = props.membersAuthorizer;

    // Admins
    httpApi.addRoutes({
      path: "/admins",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("AdminsGetInt", getAdminLambda),
    });

    // Members
    httpApi.addRoutes({
      path: "/members",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("MembersPostInt", createMemberLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/members",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("MembersGetInt", getMembersLambda),
    });
    httpApi.addRoutes({
      path: "/members",
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration("MembersPatchInt", modifyMemberLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/members",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("MembersDeleteInt", removeMemberLambda),
      ...(auth ? { authorizer: auth } : {}),
    });

    // Payments
    httpApi.addRoutes({
      path: "/payments",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("PaymentsPostInt", createPaymentLambda),
    });
    httpApi.addRoutes({
      path: "/payments",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("PaymentsDeleteInt", removePaymentLambda),
    });
    httpApi.addRoutes({
      path: "/payments",
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration("PaymentsPatchInt", updatePaymentLambda),
    });
    httpApi.addRoutes({
      path: "/payments",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("PaymentsGetInt", getPaymentLambda),
    });

    // Events
    httpApi.addRoutes({
      path: "/events",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("EventsPostInt", createEventLambda),
    });
    httpApi.addRoutes({
      path: "/events",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("EventsGetInt", getEventLambda),
    });
    httpApi.addRoutes({
      path: "/events",
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration("EventsPatchInt", updateEventLambda),
    });
    httpApi.addRoutes({
      path: "/events",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("EventsDeleteInt", removeEventLambda),
    });

    this.httpApiUrl = httpApi.apiEndpoint;
  }
}
