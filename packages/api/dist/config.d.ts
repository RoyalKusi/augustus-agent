export declare const config: {
    readonly env: string;
    readonly port: number;
    readonly db: {
        readonly host: string;
        readonly port: number;
        readonly name: string;
        readonly user: string;
        readonly password: string;
        readonly ssl: boolean;
        readonly poolMax: number;
    };
    readonly redis: {
        readonly url: string | undefined;
        readonly host: string;
        readonly port: number;
        readonly password: string | undefined;
    };
    readonly s3: {
        readonly endpoint: string | undefined;
        readonly region: string;
        readonly accessKeyId: string;
        readonly secretAccessKey: string;
        readonly bucket: string;
    };
    readonly claude: {
        readonly apiKey: string;
        readonly model: string;
    };
    readonly meta: {
        readonly appId: string;
        readonly appSecret: string;
        readonly verifyToken: string;
        readonly graphApiVersion: string;
        readonly embeddedSignupConfigId: string;
    };
    readonly paynow: {
        readonly integrationId: string;
        readonly integrationKey: string;
        readonly returnUrl: string;
        readonly resultUrl: string;
    };
    readonly email: {
        readonly provider: string;
        readonly apiKey: string;
        readonly fromAddress: string;
        readonly fromName: string;
    };
    readonly jwt: {
        readonly secret: string;
        readonly expiresIn: string;
    };
    readonly withdrawal: {
        readonly autoProcessThreshold: number;
    };
    readonly baseUrl: string;
    readonly frontendUrl: string;
    readonly encryption: {
        readonly key: string;
    };
};
//# sourceMappingURL=config.d.ts.map