export function generatePrintFilename(documentType: string, customerName: string): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${documentType} - ${customerName} - ${day}-${month}-${year}`;
}
