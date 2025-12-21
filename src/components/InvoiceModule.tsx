import React from 'react';
import { PaymentStatus, Invoice } from '../types';

interface InvoiceModuleProps {
  jobId?: string;
  clientId?: number;
  clientName?: string;
  clientEmail?: string;
  installAddress?: string;
  phone?: string;
  nip?: string;
  paymentStatus?: PaymentStatus;
  totalGross?: number;
  paidAmount?: number;
  invoices?: Invoice[];
  isAdmin?: boolean;
  onStatusChange?: (status: PaymentStatus) => Promise<void>;
  onClientDataChange?: (billingData: any) => void;
}

const InvoiceModule: React.FC<InvoiceModuleProps> = ({
  clientName,
  paymentStatus,
  isAdmin = true
}) => {
  if (!isAdmin) return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-slate-800">Faktury (Infakt)</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
          paymentStatus === PaymentStatus.PAID ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        }`}>
          {paymentStatus || 'BRAK PŁATNOŚCI'}
        </span>
      </div>
      
      <div className="text-sm text-slate-600">
        <p>Klient: <strong>{clientName || 'Brak danych'}</strong></p>
        <p className="mt-2 text-xs text-slate-400 italic">
          Pełna integracja z Infakt wkrótce...
        </p>
      </div>
    </div>
  );
};

export default InvoiceModule;
