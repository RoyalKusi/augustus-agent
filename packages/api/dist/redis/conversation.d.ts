export interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}
export declare function getConversationContext(conversationId: string): Promise<Message[]>;
export declare function appendMessage(conversationId: string, message: Message, maxMessages?: number, ttlSeconds?: number): Promise<void>;
export declare function clearConversationContext(conversationId: string): Promise<void>;
//# sourceMappingURL=conversation.d.ts.map