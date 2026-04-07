export declare const pool: import("pg").Pool;
/**
 * Run all SQL migration files in order on startup.
 * Uses a migrations tracking table to skip already-applied migrations.
 */
export declare function runMigrations(): Promise<void>;
//# sourceMappingURL=client.d.ts.map