/**
 * Notification Service
 * Requirements: 1.4, 1.7, 2.3, 2.4, 2.5, 2.6, 3.3, 3.4, 3.5, 13.2, 13.4
 * Centralised transactional email dispatch via SendGrid or AWS SES.
 */
export declare function sendEmail(to: string, subject: string, htmlBody: string, textBody?: string): Promise<void>;
export declare const emailTemplates: {
    registrationVerification(verificationUrl: string): {
        subject: string;
        html: string;
        text: string;
    };
    passwordReset(resetUrl: string): {
        subject: string;
        html: string;
        text: string;
    };
    subscriptionReminder(planName: string, daysUntilRenewal: number, renewalDate: string): {
        subject: string;
        html: string;
        text: string;
    };
    budgetAlert(usagePercent: number, planName: string): {
        subject: string;
        html: string;
        text: string;
    };
    accountSuspension(businessName: string): {
        subject: string;
        html: string;
        text: string;
    };
    supportTicketAck(ticketReference: string, subject: string): {
        subject: string;
        html: string;
        text: string;
    };
    supportTicketStatusUpdate(ticketReference: string, newStatus: string): {
        subject: string;
        html: string;
        text: string;
    };
};
export declare function sendSupportTicketAck(to: string, ticketReference: string, subject: string): Promise<void>;
export declare function sendSupportTicketStatusUpdate(to: string, ticketReference: string, newStatus: string): Promise<void>;
//# sourceMappingURL=notification.service.d.ts.map