/**
 * CRM Zlecenia Montażowe - Gemini Service
 * Parsowanie maili przez AI (przez proxy PHP)
 */

import { JobOrderData } from "../types";
import { apiService } from "./apiService";

/**
 * Parsuje wątek mailowy przez Gemini AI
 * Wywołuje backend PHP który ma klucz API
 */
export const parseGmailThread = async (
  text: string, 
  files: string[]
): Promise<JobOrderData & { suggestedTitle?: string }> => {
  try {
    // Wywołaj API proxy
    const result = await apiService.parseWithAI(text, files);
    
    // Upewnij się że wszystkie wymagane pola są obecne
    return {
      jobTitle: result.suggestedTitle || 'Nowe zlecenie',
      clientName: result.clientName || 'Nieznany klient',
      companyName: result.companyName || undefined,
      contactPerson: result.contactPerson || '',
      phoneNumber: result.phoneNumber || '',
      address: result.address || '',
      locations: result.locations || [],
      scopeWorkText: result.scopeWorkText || '',
      scopeWorkImages: result.scopeWorkImages || '',
      payment: result.payment || { type: 'UNKNOWN' as any },
      suggestedTitle: result.suggestedTitle,
    };
  } catch (error) {
    console.error("Błąd przetwarzania Gemini:", error);
    throw new Error("Nie udało się przetworzyć danych. Sprawdź pliki lub spróbuj ponownie.");
  }
};

export default { parseGmailThread };
