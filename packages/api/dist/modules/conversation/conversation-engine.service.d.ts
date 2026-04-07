export declare const MAX_CONTEXT_MESSAGES = 30;
export declare const CONTEXT_WINDOW_MS: number;
export declare const CLAUDE_HAIKU_MODEL: string;
export declare function filterContextWindow(messages: any, nowMs: any, maxMessages?: number, windowMs?: number): any;
export declare function loadConversationContext(conversationId: any, nowMs: any): Promise<any>;
export declare function isManualInterventionActive(conversation: any): boolean;
export declare function isBudgetAllowed(businessId: any): Promise<boolean>;
export declare function buildSystemPrompt(trainingData: any, products: any, detectedLanguage: any, contextSummary: any, inChatPaymentsEnabled?: boolean): string;
export declare function detectLanguage(text: any): "Chinese" | "Arabic" | "Russian" | "Hindi" | "Japanese" | "Korean" | "English";
export declare function callClaudeHaiku(systemPrompt: any, contextMessages: any, userMessage: any): Promise<{
    text: any;
    inputTokens: any;
    outputTokens: any;
}>;
export declare function parseClaudeResponse(responseText: any): {
    type: string;
    text: any;
    products: any;
    orderDetails?: undefined;
} | {
    type: string;
    text: any;
    products?: undefined;
    orderDetails?: undefined;
} | {
    type: string;
    text: any;
    orderDetails: {};
    products?: undefined;
};
export declare function isSessionExpired(messageCount: any, sessionStartMs: any, nowMs: any): boolean;
export declare function summariseAndResetSession(conversationId: any, contextMessages: any): Promise<string>;
export declare function persistConversationTurn(conversationId: any, businessId: any, inboundText: any, outboundText: any, inboundMetaMessageId: any, nowMs: any): Promise<void>;
export declare function processInboundMessage(msg: any): Promise<{
    dispatched: boolean;
    skippedManualIntervention: boolean;
    skippedBudgetExhausted?: undefined;
    action?: undefined;
} | {
    dispatched: boolean;
    skippedBudgetExhausted: boolean;
    skippedManualIntervention?: undefined;
    action?: undefined;
} | {
    dispatched: boolean;
    skippedManualIntervention?: undefined;
    skippedBudgetExhausted?: undefined;
    action?: undefined;
} | {
    dispatched: boolean;
    action: {
        type: string;
        text: any;
        products: any;
        orderDetails?: undefined;
    } | {
        type: string;
        text: any;
        products?: undefined;
        orderDetails?: undefined;
    } | {
        type: string;
        text: any;
        orderDetails: {};
        products?: undefined;
    };
    skippedManualIntervention?: undefined;
    skippedBudgetExhausted?: undefined;
}>;
export declare const CONSUMER_NAME: string;
export declare let consumerRunning: boolean;
export declare function startConversationEngineConsumer(): void;
export declare function stopConversationEngineConsumer(): void;
//# sourceMappingURL=conversation-engine.service.d.ts.map