/**
 * Training Data Service
 * Requirements: 10.1–10.4
 * Properties: 29
 */
export declare const MAX_FILE_SIZE_BYTES: number;
export type TrainingDataType = 'description' | 'faq' | 'tone_guidelines' | 'logo' | 'document';
export interface TrainingDataEntry {
    id: string;
    businessId: string;
    type: TrainingDataType;
    content: string | null;
    fileUrl: string | null;
    fileSizeBytes: number | null;
    createdAt: Date;
    updatedAt: Date | null;
}
/**
 * Returns true if the file size is within the 10 MB limit.
 * Property 29: any file > 10 MB must be rejected.
 */
export declare function isFileSizeValid(sizeBytes: number): boolean;
export declare function createTrainingEntry(businessId: string, data: {
    type: TrainingDataType;
    content?: string;
    fileUrl?: string;
    fileSizeBytes?: number;
}): Promise<TrainingDataEntry>;
export declare function listTrainingEntries(businessId: string): Promise<TrainingDataEntry[]>;
export declare function deleteTrainingEntry(businessId: string, entryId: string): Promise<boolean>;
/**
 * Updates the WhatsApp Business profile picture for a business.
 * Best-effort: logs errors but does not throw.
 */
export declare function updateWhatsAppProfile(businessId: string, logoUrl: string): Promise<void>;
//# sourceMappingURL=training.service.d.ts.map