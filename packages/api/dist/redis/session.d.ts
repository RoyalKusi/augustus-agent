export declare function setSession(token: string, data: object, ttlSeconds?: number): Promise<void>;
export declare function getSession(token: string): Promise<object | null>;
export declare function deleteSession(token: string): Promise<void>;
//# sourceMappingURL=session.d.ts.map