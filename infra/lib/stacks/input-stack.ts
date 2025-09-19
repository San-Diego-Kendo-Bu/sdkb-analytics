import { Stack, StackProps } from "aws-cdk-lib"
import { CorsHttpMethod, HttpApi, HttpMethod, IHttpRouteAuthorizer } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";
import { NafudakakeLambdaFunctions } from "./compute-stack";

export interface InputStackProps extends StackProps {
  membersAuthorizer: IHttpRouteAuthorizer;
  lambdaFunctions: NafudakakeLambdaFunctions;
}

export class InputStack extends Stack {

  public readonly httpApiUrl: string;

  constructor(scope: Construct, id: string, props: InputStackProps) {
    super(scope, id, props);

    const httpApi = new HttpApi(this, 'MyHttpApi', {
    apiName: 'MembersApi',
    corsPreflight: {
      allowHeaders: ['*'],
      exposeHeaders: ['*'],
      allowMethods: [
        CorsHttpMethod.GET,
        CorsHttpMethod.POST,
        CorsHttpMethod.PATCH,
        CorsHttpMethod.DELETE,
      ],
      allowOrigins: ['*'],
    },
    });

    // Add routes
    httpApi.addRoutes({
      path: '/admins',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetIntegration', props.lambdaFunctions.getAdminLambda),
    });

    httpApi.addRoutes({
      path: '/members',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('PostIntegration', props.lambdaFunctions.createMemberLambda),
      authorizer: props.membersAuthorizer,
    });

    httpApi.addRoutes({
      path: '/members',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetIntegration', props.lambdaFunctions.getMembersLambda),
    });

    httpApi.addRoutes({
      path: '/members',
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration('PatchIntegration', props.lambdaFunctions.modifyMemberLambda),
      authorizer: props.membersAuthorizer,
    });

    httpApi.addRoutes({
      path: '/members',
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration('DeleteIntegration', props.lambdaFunctions.removeMemberLambda),
      authorizer: props.membersAuthorizer,
    });

    httpApi.addRoutes({
      path: '/payments',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('PostIntegration', props.lambdaFunctions.createPaymentLambda),
    });

    httpApi.addRoutes({
      path: '/payments',
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration('DeleteIntegration', props.lambdaFunctions.removePaymentLambda),
    });

    httpApi.addRoutes({
      path: '/payments',
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration('PatchIntegration', props.lambdaFunctions.updatePaymentLambda),
    });
    
    httpApi.addRoutes({
      path: '/payments',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetIntegration', props.lambdaFunctions.getPaymentLambda),
    });

    this.httpApiUrl = httpApi.apiEndpoint;
  }
}
