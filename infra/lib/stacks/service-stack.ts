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

    const getMembersLambda = new NodejsFunction(this, "GetMembersLambda", {
      entry: path.join(__dirname, "../../lambdas/members/getMembers/index.js"),
      handler: "handler",
      ...commonNodejs,
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

    const getSeminarRegistrationsLambda = new NodejsFunction(this, "GetSeminarRegistrationsLambda", {
      entry: path.join(__dirname, "../../lambdas/events/getSeminarRegistrations/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });

    const getShinsaRegistrationsLambda = new NodejsFunction(this, "GetShinsaRegistrationsLambda", {
      entry: path.join(__dirname, "../../lambdas/events/getShinsaRegistrations/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });

    const getTournamentRegistrationsLambda = new NodejsFunction(this, "GetTournamentRegistrationsLambda", {
      entry: path.join(__dirname, "../../lambdas/events/getTournamentRegistrations/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });


    const registerEventLambda = new NodejsFunction(this, "RegisterEventLambda", {
      entry: path.join(__dirname, "../../lambdas/events/registerEvent/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });
    const unregisterEventLambda = new NodejsFunction(this, "UnregisterEventLambda", {
      entry: path.join(__dirname, "../../lambdas/events/unregisterEvent/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });
    
    const assignPaymentLambda = new NodejsFunction(this, "AssignPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/assigned_payments/assignPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });
    const unassignPaymentLambda = new NodejsFunction(this, "UnassignPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/assigned_payments/unassignPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });
    const updateAsgnPaymentLambda = new NodejsFunction(this, "updateAsgnPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/assigned_payments/updateAsgnPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });

    const getAsgnPaymentLambda = new NodejsFunction(this, "getAsgnPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/assigned_payments/getAsgnPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });

    const submitPaymentLambda = new NodejsFunction(this, "SubmitPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/submitted_payments/submitPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });
    const removeSbmtPaymentLambda = new NodejsFunction(this, "RemoveSbmtPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/submitted_payments/removeSbmtPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SUPABASE_SECRET_ID: props.supabaseSecret.secretName },
    });
    const getSbmtPaymentLambda = new NodejsFunction(this, "GetSbmtPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/submitted_payments/getSbmtPayment/index.js"),
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

    const configureEventLambda = new NodejsFunction(this, "ConfigureEventLambda", {
      entry: path.join(__dirname, "../../lambdas/events/configureEvent/index.js"),
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

    const broadcastPaymentLambda = new NodejsFunction(this, "BroadcastPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/broadcasted_payments/broadcast_payment/index.js"),
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

    props.supabaseSecret.grantRead(assignPaymentLambda);
    props.supabaseSecret.grantRead(unassignPaymentLambda);
    props.supabaseSecret.grantRead(updateAsgnPaymentLambda);
    props.supabaseSecret.grantRead(getAsgnPaymentLambda);

    props.supabaseSecret.grantRead(submitPaymentLambda);
    props.supabaseSecret.grantRead(removeSbmtPaymentLambda);
    props.supabaseSecret.grantRead(getSbmtPaymentLambda);

    props.supabaseSecret.grantRead(createEventLambda);
    props.supabaseSecret.grantRead(getEventLambda);
    props.supabaseSecret.grantRead(updateEventLambda);
    props.supabaseSecret.grantRead(removeEventLambda);
    props.supabaseSecret.grantRead(registerEventLambda);
    props.supabaseSecret.grantRead(unregisterEventLambda);
    props.supabaseSecret.grantRead(configureEventLambda);
    props.supabaseSecret.grantRead(getSeminarRegistrationsLambda);
    props.supabaseSecret.grantRead(getShinsaRegistrationsLambda);
    props.supabaseSecret.grantRead(getTournamentRegistrationsLambda);

    props.supabaseSecret.grantRead(broadcastPaymentLambda);

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

    assignPaymentLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [members],
    }));
    
    submitPaymentLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [members],
    }));

    createEventLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [config],
    }));

    registerEventLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [members],
    }));

    unregisterEventLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [members],
    }));

    broadcastPaymentLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Scan"],
      resources: [members],
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
      path: "/payments/broadcast",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("BroadcastPaymentsPostInt", broadcastPaymentLambda),
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
    
    // Assigned Payments
    httpApi.addRoutes({
      path: "/assignedpayments",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("AssignedPaymentsPostInt", assignPaymentLambda),
    });
    httpApi.addRoutes({
      path: "/assignedpayments",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("AssignedPaymentsDeleteInt", unassignPaymentLambda),
    });
    httpApi.addRoutes({
      path: "/assignedpayments",
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration("AssignedPaymentsPatchInt", updateAsgnPaymentLambda),
    });
    httpApi.addRoutes({
      path: "/assignedpayments",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("AssignedPaymentsGetInt", getAsgnPaymentLambda),
    });

    // Submitted Payments
    httpApi.addRoutes({
      path: "/submittedpayments",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("SubmittedPaymentsPostInt", submitPaymentLambda),
    });
    httpApi.addRoutes({
      path: "/submittedpayments",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("SubmittedPaymentsDeleteInt", removeSbmtPaymentLambda),
    });
    httpApi.addRoutes({
      path: "/submittedpayments",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("SubmittedPaymentsGetInt", getSbmtPaymentLambda),
    });

    // Events
    httpApi.addRoutes({
      path: "/events",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("EventsPostInt", createEventLambda),
    });
    httpApi.addRoutes({
      path: "/events/register",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("EventsRegisterInt", registerEventLambda),
    });
    httpApi.addRoutes({
      path: "/events/register",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("EventsUnregisterInt", unregisterEventLambda),
    });
    httpApi.addRoutes({
      path: "/events/configure",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("EventsConfigureInt", configureEventLambda),
    });
    httpApi.addRoutes({
      path: "/events",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("EventsGetInt", getEventLambda),
    });
    httpApi.addRoutes({
      path: "/events/tournamentRegistrations",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("EventsGetTournamentRegistrationsInt", getTournamentRegistrationsLambda),
    });
    httpApi.addRoutes({
      path: "/events/shinsaRegistrations",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("EventsGetShinsaRegistrationsInt", getShinsaRegistrationsLambda),
    });
    httpApi.addRoutes({
      path: "/events/seminarRegistrations",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("EventsGetSeminarRegistrationsInt", getSeminarRegistrationsLambda),
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
