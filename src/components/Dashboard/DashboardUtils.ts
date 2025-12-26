import { PaymentStatus } from '../../types';

export const deg2rad = (deg: number) => {
  return deg * (Math.PI / 180);
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

export const parseAddressForNav = (address: string | undefined) => {
  if (!address) return { street: 'Brak adresu', city: '' };
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const street = parts[0];
    let city = parts[1].replace(/\d{2}-\d{3}\s*/g, '').trim(); // Remove postal code
    if (!city && parts[2]) city = parts[2].replace(/\d{2}-\d{3}\s*/g, '').trim();
    return { street, city };
  }
  return { street: address, city: '' };
};

export const formatPhoneNumber = (phone: string | undefined): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s-]/g, '');
  const match = cleaned.match(/^(\+48)?(\d{9})$/);
  if (match) {
    const prefix = match[1] ? '+48 ' : '';
    const num = match[2];
    return `${prefix}${num.slice(0, 3)} ${num.slice(3, 6)} ${num.slice(6, 9)}`;
  }
  return phone;
};

export const formatAddressShort = (address: string | undefined): string => {
  if (!address) return 'BRAK ADRESU';
  const parts = address.split(',');
  if (parts.length >= 2) {
    const street = parts[0].trim();
    let city = parts[1].trim();
    city = city.replace(/\d{2}-\d{3}\s*/, '').trim();
    if (!city && parts[2]) {
      city = parts[2].trim();
    }
    return city ? `${street}, ${city}` : street;
  }
  return address;
};

// ============================================
// DOM HELPERS DLA PRZESUWANIA KART
// ============================================

export const getOrderedIdsFromDOM = (container: HTMLElement): string[] => {
  return Array.from(container.querySelectorAll('[data-job-id]'))
    .map(el => el.getAttribute('data-job-id'))
    .filter(Boolean) as string[];
};

export const moveCardByOne = (cardEl: HTMLElement, direction: -1 | 1): void => {
  const container = cardEl.parentElement;
  if (!container) return;

  if (direction === 1) {
    const next = cardEl.nextElementSibling as HTMLElement | null;
    if (next) {
      next.after(cardEl);
    }
  } else {
    const prev = cardEl.previousElementSibling as HTMLElement | null;
    if (prev) {
      prev.before(cardEl);
    }
  }
};

export const getPaymentStatusColor = (status: PaymentStatus): string => {
  switch (status) {
    case PaymentStatus.PAID: return '#22c55e'; // green
    case PaymentStatus.PROFORMA: return '#f97316'; // orange
    case PaymentStatus.PARTIAL: return '#f97316'; // orange
    case PaymentStatus.CASH: return '#eab308'; // yellow
    case PaymentStatus.OVERDUE: return '#ea580c'; // dark orange
    default: return 'transparent';
  }
};

export const getPaymentStatusLabel = (status: PaymentStatus): string => {
  switch (status) {
    case PaymentStatus.PAID: return 'OPŁACONE';
    case PaymentStatus.PROFORMA: return 'PROFORMA';
    case PaymentStatus.PARTIAL: return 'ZALICZKA';
    case PaymentStatus.CASH: return 'GOTÓWKA';
    case PaymentStatus.OVERDUE: return 'DO ZAPŁATY';
    default: return '';
  }
};

