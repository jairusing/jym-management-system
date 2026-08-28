import { formatDateTime } from '../../lib/dates';
import { type Payment, type PaymentMethod } from './paymentRepository';
import { type Invoice } from './invoiceRepository';

export type ReceiptSource = {
  invoiceNumber: string;
  memberName: string;
  planName: string | null;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paidAt: string;
  takenBy: string | null;
};

export type ReceiptData = ReceiptSource & {
  amountLabel: string;
  methodLabel: string;
  paidAtLabel: string;
  amountInWords: string;
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  card: 'Card',
  bank: 'Bank transfer'
};

export function formatMoneyPHP(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

export function receiptFromPayment(
  invoice: Invoice,
  payment: Payment,
  takenBy: string | null = null
): ReceiptSource {
  return {
    invoiceNumber: payment.invoiceNumber ?? invoice.invoiceNumber,
    memberName: payment.memberName,
    planName: invoice.planName ?? null,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
    paidAt: payment.paidAt,
    takenBy: takenBy ?? payment.processedBy
  };
}

export function buildReceipt(source: ReceiptSource): ReceiptData {
  return {
    ...source,
    amountLabel: formatMoneyPHP(source.amount),
    methodLabel: METHOD_LABELS[source.method],
    paidAtLabel: formatDateTime(source.paidAt),
    amountInWords: amountInWords(source.amount)
  };
}

const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TEENS = [
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen'
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) {
    parts.push(`${ONES[hundreds]} Hundred`);
  }
  if (rest > 0) {
    if (rest < 10) {
      parts.push(ONES[rest]);
    } else if (rest < 20) {
      parts.push(TEENS[rest - 10]);
    } else {
      const tens = Math.floor(rest / 10);
      const ones = rest % 10;
      parts.push(ones > 0 ? `${TENS[tens]}-${ONES[ones]}` : TENS[tens]);
    }
  }
  return parts.join(' ');
}

export function amountInWords(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const pesos = Math.floor(rounded);
  const centavos = Math.round((rounded - pesos) * 100);

  let pesosWords: string;
  if (pesos === 0) {
    pesosWords = 'Zero';
  } else {
    const millions = Math.floor(pesos / 1_000_000);
    const thousands = Math.floor((pesos % 1_000_000) / 1000);
    const rest = pesos % 1000;
    const parts: string[] = [];
    if (millions > 0) {
      parts.push(`${threeDigits(millions)} Million`);
    }
    if (thousands > 0) {
      parts.push(`${threeDigits(thousands)} Thousand`);
    }
    if (rest > 0) {
      parts.push(threeDigits(rest));
    }
    pesosWords = parts.join(' ');
  }

  return `${pesosWords} Pesos and ${String(centavos).padStart(2, '0')}/100 Only`;
}