import { Duration, Stack, StackProps } from "aws-cdk-lib";
import { Distribution } from "aws-cdk-lib/aws-cloudfront";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, CacheControl, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import fs from "fs";
import path from "path";

export interface StorageStackProps extends StackProps {}

export class StorageStack extends Stack {
  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    // Import existing bucket
    const siteBucket = Bucket.fromBucketName(this, 'ExistingBucket', 'nafudakake');
    const frontendDir = path.join(__dirname, '../../../frontend');

    const distribution = Distribution.fromDistributionAttributes(this, 'ImportedDist', {
      distributionId: 'E2BATTQHTLXB4Y',                 // ← find in console/CLI
      domainName: 'd3j7mmciz70vi1.cloudfront.net',      // NOT your custom alias
    });

    // Long-cache everything EXCEPT index.html and JS
    new BucketDeployment(this, 'AssetsLongCache', {
      sources: [Source.asset(frontendDir, { exclude: ['index.html', 'js/**', 'css/**'] })],
      destinationBucket: siteBucket,
      prune: false,
      cacheControl: [
        CacheControl.maxAge(Duration.days(365)),
        CacheControl.immutable(),
      ],
    });

    // No-cache ALL JS (covers main.js and its imports)
    new BucketDeployment(this, 'JSNoCache', {
      sources: [ Source.asset(path.join(frontendDir, 'js')) ],
      destinationBucket: siteBucket,
      destinationKeyPrefix: 'js',  // ensures keys are js/<file>
      prune: false,
      cacheControl: [
        CacheControl.noCache(),
        CacheControl.noStore(),
        CacheControl.mustRevalidate(),
      ],
      distribution,
      distributionPaths: ['/js/*'],
    });

    // No-cache ALL CSS (covers main.js and its imports)
    new BucketDeployment(this, 'CSSSNoCache', {
      sources: [ Source.asset(path.join(frontendDir, 'css')) ],
      destinationBucket: siteBucket,
      destinationKeyPrefix: 'css',  // ensures keys are css/<file>
      prune: false,
      cacheControl: [
        CacheControl.noCache(),
        CacheControl.noStore(),
        CacheControl.mustRevalidate(),
      ],
      distribution,
      distributionPaths: ['/css/*'],
    });

    // No-cache index.html
    new BucketDeployment(this, 'IndexNoCache', {
      sources: [
        Source.data(
          'index.html',
          fs.readFileSync(path.join(frontendDir, 'index.html'), 'utf8')
        ),
      ],
      destinationBucket: siteBucket,
      prune: false,
      contentType: 'text/html; charset=utf-8',
      cacheControl: [
        CacheControl.noCache(),
        CacheControl.noStore(),
        CacheControl.mustRevalidate(),
      ],
      distribution,
      distributionPaths: ['/*'],
    });


  }
}
