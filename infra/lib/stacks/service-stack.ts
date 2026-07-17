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
import { IUserPool } from "aws-cdk-lib/aws-cognito";

import * as scheduler from 'aws-cdk-lib/aws-scheduler'; // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_scheduler-readme.html
import * as targets from 'aws-cdk-lib/aws-scheduler-targets'
import * as s3 from "aws-cdk-lib/aws-s3";
import { DatabaseStack } from "./database-stack";
import { get } from "http";

export interface ServiceStackProps extends StackProps {
  membersAuthorizer?: IHttpRouteAuthorizer;   // attach to protected routes if provided
  stripeSecret: ISecret;
  stripeSecretPk: ISecret;
  gmailSecret: ISecret;
  membersTableArn: string;
  configTableArn: string;
  userPool: IUserPool;
  databaseStack: DatabaseStack;
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

    const updateMemberSelfLambda = new NodejsFunction(this, "UpdateMemberSelfLambda", {
      entry: path.join(__dirname, "../../lambdas/members/updateMemberSelf/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const getNafudaOrderLambda = new NodejsFunction(this, "GetNafudaOrderLambda", {
      entry: path.join(__dirname, "../../lambdas/nafuda/getNafudaOrder/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const setNafudaOrderLambda = new NodejsFunction(this, "SetNafudaOrderLambda", {
      entry: path.join(__dirname, "../../lambdas/nafuda/setNafudaOrder/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const getAdminLambda = new NodejsFunction(this, "GetAdminLambda", {
      entry: path.join(__dirname, "../../lambdas/admins/getAdmin/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const removeMemberLambda = new NodejsFunction(this, "RemoveMemberLambda", {
      entry: path.join(__dirname, "../../lambdas/members/removeMember/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SECRET_ID: props.stripeSecret.secretName },
    });

    const modifyMemberLambda = new NodejsFunction(this, "ModifyMemberLambda", {
      entry: path.join(__dirname, "../../lambdas/members/modifyMember/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const createPaymentLambda = new NodejsFunction(this, "CreatePaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/payments/createPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const removePaymentLambda = new NodejsFunction(this, "RemovePaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/payments/removePayment/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const updatePaymentLambda = new NodejsFunction(this, "UpdatePaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/payments/updatePayment/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const getPaymentLambda = new NodejsFunction(this, "GetPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/payments/getPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const clearOvrPaymentsLambda = new NodejsFunction(this, "ClearOvrPaymentsLambda", {
      entry: path.join(__dirname, "../../lambdas/payments/clearOverduePayments/index.js"),
      handler: "handler",
      ...commonNodejs,
    });


    const getSeminarRegistrationsLambda = new NodejsFunction(this, "GetSeminarRegistrationsLambda", {
      entry: path.join(__dirname, "../../lambdas/events/getSeminarRegistrations/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const getSpecialEventRegistrationsLambda = new NodejsFunction(this, "GetSpecialEventRegistrationsLambda", {
      entry: path.join(__dirname, "../../lambdas/events/getSpecialEventRegistrations/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const getShinsaRegistrationsLambda = new NodejsFunction(this, "GetShinsaRegistrationsLambda", {
      entry: path.join(__dirname, "../../lambdas/events/getShinsaRegistrations/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const getTournamentRegistrationsLambda = new NodejsFunction(this, "GetTournamentRegistrationsLambda", {
      entry: path.join(__dirname, "../../lambdas/events/getTournamentRegistrations/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const registerEventLambda = new NodejsFunction(this, "RegisterEventLambda", {
      entry: path.join(__dirname, "../../lambdas/events/registerEvent/index.js"),
      handler: "handler",
      ...commonNodejs,
    });
    const unregisterEventLambda = new NodejsFunction(this, "UnregisterEventLambda", {
      entry: path.join(__dirname, "../../lambdas/events/unregisterEvent/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const assignPaymentLambda = new NodejsFunction(this, "AssignPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/assigned_payments/assignPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
      bundling: { ...commonNodejs.bundling, nodeModules: ["nodemailer"] },
      memorySize: 256,
      timeout: Duration.seconds(30),
      environment: { GMAIL_SECRET_ID: props.gmailSecret.secretName },
    });

    const unassignPaymentLambda = new NodejsFunction(this, "UnassignPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/assigned_payments/unassignPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const updateAsgnPaymentLambda = new NodejsFunction(this, "updateAsgnPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/assigned_payments/updateAsgnPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const getAsgnPaymentLambda = new NodejsFunction(this, "getAsgnPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/assigned_payments/getAsgnPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const removeSbmtPaymentLambda = new NodejsFunction(this, "RemoveSbmtPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/submitted_payments/removeSbmtPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
    });
    const getSbmtPaymentLambda = new NodejsFunction(this, "GetSbmtPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/submitted_payments/getSbmtPayment/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const createPaymentIntentLambda = new NodejsFunction(this, "CreatePaymentIntentLambda", {
      entry: path.join(__dirname, "../../lambdas/payments/createPaymentIntent/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: {
        SECRET_ID: props.stripeSecret.secretName,
        PK_SECRET_ID: props.stripeSecretPk.secretName,
      },
    });

    const createEventLambda = new NodejsFunction(this, "CreateEventLambda", {
      entry: path.join(__dirname, "../../lambdas/events/createEvent/index.js"),
      handler: "handler",
      ...commonNodejs,
      bundling: { ...commonNodejs.bundling, nodeModules: ["nodemailer"] },
      memorySize: 256,
      timeout: Duration.seconds(60),
      environment: { GMAIL_SECRET_ID: props.gmailSecret.secretName },
    });

    const configureEventLambda = new NodejsFunction(this, "ConfigureEventLambda", {
      entry: path.join(__dirname, "../../lambdas/events/configureEvent/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const getEventConfigLambda = new NodejsFunction(this, "GetEventConfigLambda", {
      entry: path.join(__dirname, "../../lambdas/events/getEventConfig/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const getEventLambda = new NodejsFunction(this, "GetEventLambda", {
      entry: path.join(__dirname, "../../lambdas/events/getEvents/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const updateEventLambda = new NodejsFunction(this, "UpdateEventLambda", {
      entry: path.join(__dirname, "../../lambdas/events/updateEvent/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const removeEventLambda = new NodejsFunction(this, "RemoveEventLambda", {
      entry: path.join(__dirname, "../../lambdas/events/removeEvent/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const broadcastPaymentLambda = new NodejsFunction(this, "BroadcastPaymentLambda", {
      entry: path.join(__dirname, "../../lambdas/broadcasted_payments/broadcast_payment/index.js"),
      handler: "handler",
      ...commonNodejs,
      bundling: { ...commonNodejs.bundling, nodeModules: ["nodemailer"] },
      memorySize: 256,
      timeout: Duration.seconds(60),
      environment: { GMAIL_SECRET_ID: props.gmailSecret.secretName },
    });

    const getFamiliesLambda = new NodejsFunction(this, "GetFamiliesLambda", {
      entry: path.join(__dirname, "../../lambdas/families/getFamilies/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const createFamilyLambda = new NodejsFunction(this, "CreateFamilyLambda", {
      entry: path.join(__dirname, "../../lambdas/families/createFamily/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const updateFamilyLambda = new NodejsFunction(this, "UpdateFamilyLambda", {
      entry: path.join(__dirname, "../../lambdas/families/updateFamily/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const deleteFamilyLambda = new NodejsFunction(this, "DeleteFamilyLambda", {
      entry: path.join(__dirname, "../../lambdas/families/deleteFamily/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const getRecurringsLambda = new NodejsFunction(this, "GetRecurringsLambda", {
      entry: path.join(__dirname, "../../lambdas/recurring_payments/getRecurrings/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const createRecurringLambda = new NodejsFunction(this, "CreateRecurringLambda", {
      entry: path.join(__dirname, "../../lambdas/recurring_payments/createRecurring/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const deleteRecurringLambda = new NodejsFunction(this, "DeleteRecurringLambda", {
      entry: path.join(__dirname, "../../lambdas/recurring_payments/deleteRecurring/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const processRecurringsLambda = new NodejsFunction(this, "ProcessRecurringsLambda", {
      entry: path.join(__dirname, "../../lambdas/recurring_payments/processRecurrings/index.js"),
      handler: "handler",
      ...commonNodejs,
      bundling: { ...commonNodejs.bundling, nodeModules: ["nodemailer"] },
      memorySize: 256,
      timeout: Duration.seconds(120),
      environment: { GMAIL_SECRET_ID: props.gmailSecret.secretName },
    });

    const paymentDeadlineReminderLambda = new NodejsFunction(this, "PaymentDeadlineReminderLambda", {
      entry: path.join(__dirname, "../../lambdas/notifications/paymentDeadlineReminder/index.js"),
      handler: "handler",
      ...commonNodejs,
      bundling: { ...commonNodejs.bundling, nodeModules: ["nodemailer"] },
      memorySize: 256,
      timeout: Duration.seconds(60),
      environment: { GMAIL_SECRET_ID: props.gmailSecret.secretName },
    });

    const stripeWebhookLambda = new NodejsFunction(this, "StripeWebhookLambda", {
      entry: path.join(__dirname, "../../lambdas/webhooks/stripeWebhook/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { SECRET_ID: props.stripeSecret.secretName },
    });

    const createTournamentResultLambda = new NodejsFunction(this, "CreateTournamentResultLambda", {
      entry: path.join(__dirname, "../../lambdas/tournaments/createTournamentResult/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const getTournamentResultsLambda = new NodejsFunction(this, "GetTournamentResultsLambda", {
      entry: path.join(__dirname, "../../lambdas/tournaments/getTournamentResults/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const deleteTournamentResultLambda = new NodejsFunction(this, "DeleteTournamentResultLambda", {
      entry: path.join(__dirname, "../../lambdas/tournaments/deleteTournamentResult/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    // ---- Newsletter S3 bucket
    const newsletterBucket = new s3.Bucket(this, "NewsletterBucket", {
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        blockPublicPolicy: false,
        ignorePublicAcls: true,
        restrictPublicBuckets: false,
      }),
      cors: [{
        allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
        allowedOrigins: ["*"],
        allowedHeaders: ["*"],
        maxAge: 3000,
      }],
    });

    newsletterBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.AnyPrincipal()],
      actions: ["s3:GetObject"],
      resources: [`${newsletterBucket.bucketArn}/*`],
    }));

    // ---- Announcement Lambdas
    const getAnnouncementsLambda = new NodejsFunction(this, "GetAnnouncementsLambda", {
      entry: path.join(__dirname, "../../lambdas/announcements/getAnnouncements/index.js"),
      handler: "handler",
      ...commonNodejs,
    });

    const getUploadUrlLambda = new NodejsFunction(this, "GetUploadUrlLambda", {
      entry: path.join(__dirname, "../../lambdas/announcements/getUploadUrl/index.js"),
      handler: "handler",
      ...commonNodejs,
      environment: { NEWSLETTER_BUCKET_NAME: newsletterBucket.bucketName },
    });

    const sendAnnouncementLambda = new NodejsFunction(this, "SendAnnouncementLambda", {
      entry: path.join(__dirname, "../../lambdas/announcements/sendAnnouncement/index.js"),
      handler: "handler",
      ...commonNodejs,
      bundling: { ...commonNodejs.bundling, nodeModules: ["nodemailer"] },
      memorySize: 512,
      timeout: Duration.seconds(60),
      environment: { GMAIL_SECRET_ID: props.gmailSecret.secretName },
    });

    props.databaseStack.grantDatabaseAccess(getRecurringsLambda);
    props.databaseStack.grantDatabaseAccess(createRecurringLambda);
    props.databaseStack.grantDatabaseAccess(deleteRecurringLambda);
    props.databaseStack.grantDatabaseAccess(processRecurringsLambda);
    props.databaseStack.grantDatabaseAccess(getFamiliesLambda);
    props.databaseStack.grantDatabaseAccess(createFamilyLambda);
    props.databaseStack.grantDatabaseAccess(updateFamilyLambda);
    props.databaseStack.grantDatabaseAccess(deleteFamilyLambda);
    props.databaseStack.grantDatabaseAccess(paymentDeadlineReminderLambda);
    props.databaseStack.grantDatabaseAccess(stripeWebhookLambda);
    props.databaseStack.grantDatabaseAccess(broadcastPaymentLambda);
    props.databaseStack.grantDatabaseAccess(createPaymentLambda);
    props.databaseStack.grantDatabaseAccess(getPaymentLambda);
    props.databaseStack.grantDatabaseAccess(removePaymentLambda);
    props.databaseStack.grantDatabaseAccess(updatePaymentLambda);
    props.databaseStack.grantDatabaseAccess(assignPaymentLambda);
    props.databaseStack.grantDatabaseAccess(getAsgnPaymentLambda);
    props.databaseStack.grantDatabaseAccess(unassignPaymentLambda);
    props.databaseStack.grantDatabaseAccess(updateAsgnPaymentLambda);
    props.databaseStack.grantDatabaseAccess(configureEventLambda);
    props.databaseStack.grantDatabaseAccess(getEventConfigLambda);
    props.databaseStack.grantDatabaseAccess(createEventLambda);
    props.databaseStack.grantDatabaseAccess(getEventLambda);
    props.databaseStack.grantDatabaseAccess(updateEventLambda);
    props.databaseStack.grantDatabaseAccess(removeEventLambda);
    props.databaseStack.grantDatabaseAccess(getSeminarRegistrationsLambda);
    props.databaseStack.grantDatabaseAccess(getSpecialEventRegistrationsLambda);
    props.databaseStack.grantDatabaseAccess(getShinsaRegistrationsLambda);
    props.databaseStack.grantDatabaseAccess(getTournamentRegistrationsLambda);
    props.databaseStack.grantDatabaseAccess(registerEventLambda);
    props.databaseStack.grantDatabaseAccess(unregisterEventLambda);
    props.databaseStack.grantDatabaseAccess(getSbmtPaymentLambda);
    props.databaseStack.grantDatabaseAccess(removeSbmtPaymentLambda);
    props.databaseStack.grantDatabaseAccess(clearOvrPaymentsLambda);
    props.databaseStack.grantDatabaseAccess(createPaymentIntentLambda);
    props.databaseStack.grantDatabaseAccess(getAnnouncementsLambda);
    props.databaseStack.grantDatabaseAccess(sendAnnouncementLambda);
    props.databaseStack.grantDatabaseAccess(removeMemberLambda);
    props.databaseStack.grantDatabaseAccess(updateMemberSelfLambda);
    props.databaseStack.grantDatabaseAccess(createTournamentResultLambda);
    props.databaseStack.grantDatabaseAccess(getTournamentResultsLambda);
    props.databaseStack.grantDatabaseAccess(deleteTournamentResultLambda);


    // ---- Secrets access (same as your IamStack)
    props.stripeSecret.grantRead(createMemberLambda);
    props.stripeSecret.grantRead(removeMemberLambda);
    props.stripeSecret.grantRead(createPaymentIntentLambda);
    props.stripeSecret.grantRead(stripeWebhookLambda);
    props.stripeSecretPk.grantRead(createPaymentIntentLambda);

    // ---- DynamoDB policies (same as your IamStack)
    const members = props.membersTableArn;
    const config = props.configTableArn;

    getMembersLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Scan"],
      resources: [members],
    }));

    getMembersLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [members, `${members}/index/email-index`, `${members}/index/username-index`],
    }));

    broadcastPaymentLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Scan"],
      resources: [members],
    }));

    broadcastPaymentLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [config],
    }));

    createPaymentLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [config],
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

    removeMemberLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:GetItem"],
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
    modifyMemberLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:GetItem"],
      resources: [members],
    }));
    modifyMemberLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["cognito-idp:AdminUpdateUserAttributes"],
      resources: [props.userPool.userPoolArn],
    }));

    assignPaymentLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [members],
    }));

    updateMemberSelfLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [members, `${members}/index/username-index`],
    }));
    updateMemberSelfLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [members],
    }));

    getNafudaOrderLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:GetItem"],
      resources: [config],
    }));
    setNafudaOrderLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:PutItem"],
      resources: [config],
    }));

    stripeWebhookLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [members],
    }));

    createPaymentIntentLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Query"],
      resources: [members],
    }));

    newsletterBucket.grantPut(getUploadUrlLambda);

    sendAnnouncementLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Scan"],
      resources: [members],
    }));
    props.gmailSecret.grantRead(sendAnnouncementLambda);
    props.gmailSecret.grantRead(createEventLambda);
    props.gmailSecret.grantRead(assignPaymentLambda);
    props.gmailSecret.grantRead(broadcastPaymentLambda);
    props.gmailSecret.grantRead(paymentDeadlineReminderLambda);
    props.gmailSecret.grantRead(processRecurringsLambda);
    props.gmailSecret.grantRead(createRecurringLambda);

    // createEvent needs to scan members to send new-event emails
    createEventLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Scan"],
      resources: [members],
    }));

    // paymentDeadlineReminder needs to scan members to look up emails
    paymentDeadlineReminderLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Scan"],
      resources: [members],
    }));

    createFamilyLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [config],
    }));

    createRecurringLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [config],
    }));
    createRecurringLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Scan"],
      resources: [members],
    }));

    processRecurringsLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:UpdateItem"],
      resources: [config],
    }));
    processRecurringsLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ["dynamodb:Scan"],
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
          CorsHttpMethod.PUT,
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
      ...(auth ? { authorizer: auth } : {}),
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
      path: "/members/self",
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration("MembersSelfPatchInt", updateMemberSelfLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/nafudaorder",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("NafudaOrderGetInt", getNafudaOrderLambda),
    });
    httpApi.addRoutes({
      path: "/nafudaorder",
      methods: [HttpMethod.PUT],
      integration: new HttpLambdaIntegration("NafudaOrderPutInt", setNafudaOrderLambda),
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
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/payments/broadcast",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("BroadcastPaymentsPostInt", broadcastPaymentLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/payments",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("PaymentsDeleteInt", removePaymentLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/payments",
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration("PaymentsPatchInt", updatePaymentLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/payments",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("PaymentsGetInt", getPaymentLambda),
    });
    httpApi.addRoutes({
      path: "/payments/intent",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("PaymentsIntentPostInt", createPaymentIntentLambda),
    });

    // Assigned Payments
    httpApi.addRoutes({
      path: "/assignedpayments",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("AssignedPaymentsPostInt", assignPaymentLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/assignedpayments",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("AssignedPaymentsDeleteInt", unassignPaymentLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/assignedpayments",
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration("AssignedPaymentsPatchInt", updateAsgnPaymentLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/assignedpayments",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("AssignedPaymentsGetInt", getAsgnPaymentLambda),
    });

    // Submitted Payments
    httpApi.addRoutes({
      path: "/submittedpayments",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("SubmittedPaymentsDeleteInt", removeSbmtPaymentLambda),
      ...(auth ? { authorizer: auth } : {}),
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
      ...(auth ? { authorizer: auth } : {}),
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
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/events/configure",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("EventsGetConfigInt", getEventConfigLambda),
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
      path: "/events/specialEventRegistrations",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("EventsGetSpecialEventRegistrationsInt", getSpecialEventRegistrationsLambda),
    });
    httpApi.addRoutes({
      path: "/events",
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration("EventsPatchInt", updateEventLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/events",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("EventsDeleteInt", removeEventLambda),
      ...(auth ? { authorizer: auth } : {}),
    });

    // Tournament Results
    httpApi.addRoutes({
      path: "/events/tournamentResults",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("TournamentResultsPostInt", createTournamentResultLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/events/tournamentResults",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("TournamentResultsGetInt", getTournamentResultsLambda),
    });
    httpApi.addRoutes({
      path: "/events/tournamentResults",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("TournamentResultsDeleteInt", deleteTournamentResultLambda),
      ...(auth ? { authorizer: auth } : {}),
    });

    // Recurring Payments
    httpApi.addRoutes({
      path: "/recurringpayments",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("RecurringGetInt", getRecurringsLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/recurringpayments",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("RecurringPostInt", createRecurringLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/recurringpayments",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("RecurringDeleteInt", deleteRecurringLambda),
      ...(auth ? { authorizer: auth } : {}),
    });

    // Families
    httpApi.addRoutes({
      path: "/families",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("FamiliesGetInt", getFamiliesLambda),
    });
    httpApi.addRoutes({
      path: "/families",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("FamiliesPostInt", createFamilyLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/families",
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration("FamiliesPatchInt", updateFamilyLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/families",
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("FamiliesDeleteInt", deleteFamilyLambda),
      ...(auth ? { authorizer: auth } : {}),
    });

    // Stripe webhook (no authorizer — Stripe signs requests with HMAC)
    httpApi.addRoutes({
      path: "/webhooks/stripe",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("StripeWebhookInt", stripeWebhookLambda),
    });

    // Announcements
    httpApi.addRoutes({
      path: "/announcements",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("AnnouncementsGetInt", getAnnouncementsLambda),
    });
    httpApi.addRoutes({
      path: "/announcements/upload-url",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("AnnouncementsUploadUrlInt", getUploadUrlLambda),
      ...(auth ? { authorizer: auth } : {}),
    });
    httpApi.addRoutes({
      path: "/announcements/send",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("AnnouncementsSendInt", sendAnnouncementLambda),
      ...(auth ? { authorizer: auth } : {}),
    });

    const { userPool } = props;

    // ---- Schedulers
    const clearPaymentScheduleRole = new iam.Role(this, 'clearPaymentScheduleRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });
    clearOvrPaymentsLambda.grantInvoke(clearPaymentScheduleRole);
    
    const target = new targets.LambdaInvoke(clearOvrPaymentsLambda, {
      role: clearPaymentScheduleRole,
    });
    const schedule = new scheduler.Schedule(this, 'ClearPaymentsSchedule', {
        schedule: scheduler.ScheduleExpression.rate(Duration.days(1)),
        target: target,
        enabled: false,
        description: 'This schedule periodically calls clearOvrPaymentsLambda. Functions as a scheduled database cleanup for payments.',
    });

    const processRecurringsScheduleRole = new iam.Role(this, 'processRecurringsScheduleRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });
    processRecurringsLambda.grantInvoke(processRecurringsScheduleRole);
    new scheduler.Schedule(this, 'ProcessRecurringsSchedule', {
      schedule: scheduler.ScheduleExpression.cron({ hour: '8', minute: '0' }),
      target: new targets.LambdaInvoke(processRecurringsLambda, { role: processRecurringsScheduleRole }),
      enabled: true,
      description: 'Daily 8am UTC: creates payment instances for any active recurring configs whose next_due_date has arrived, assigns to members, and sends emails.',
    });

    const paymentReminderScheduleRole = new iam.Role(this, 'paymentReminderScheduleRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });
    paymentDeadlineReminderLambda.grantInvoke(paymentReminderScheduleRole);
    new scheduler.Schedule(this, 'PaymentDeadlineReminderSchedule', {
      schedule: scheduler.ScheduleExpression.rate(Duration.days(1)),
      target: new targets.LambdaInvoke(paymentDeadlineReminderLambda, { role: paymentReminderScheduleRole }),
      enabled: true,
      description: 'Daily check for assigned payments due in 3 days; sends email reminders to members.',
    });

    // Cognito permissions
    createMemberLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:AdminCreateUser'],
      resources: [userPool.userPoolArn],
    }),);

    removeMemberLambda.role?.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:AdminDeleteUser'],
      resources: [userPool.userPoolArn],
    }),);

    this.httpApiUrl = httpApi.apiEndpoint;
  }
}
