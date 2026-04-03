/**
 * Email notification stub — real implementation in Task 14.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  console.log(`[Email] to=${to} subject="${subject}" html=${html.slice(0, 80)}...`);
}
