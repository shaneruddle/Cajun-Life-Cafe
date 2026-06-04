import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

function formatToE164(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.startsWith('0')) return `+66${digits.slice(1)}`;
  if (!digits.startsWith('66')) return `+66${digits}`;
  return `+${digits}`;
}

async function sendSMSToBackend(to: string, message: string) {
  const response = await fetch('/api/send-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, body: message })
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Failed to send SMS');
  return result;
}

async function sendOTPToBackend(to: string) {
  const response = await fetch('/api/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to })
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Failed to send OTP');
  return result;
}

async function verifyOTPWithBackend(to: string, code: string) {
  const response = await fetch('/api/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, code })
  });
  return response.json();
}

// All customers live in crm_customers
async function getCustomerData(customerId: string) {
  const snap = await getDoc(doc(db, 'crm_customers', customerId));
  if (snap.exists()) return snap.data();
  throw new Error('Customer not found in crm_customers');
}

export async function sendVerificationCode(mobile: string) {
  return sendOTPToBackend(formatToE164(mobile));
}

export async function sendBalanceUpdate(customerId: string, amount: number, type: 'TOP_UP' | 'REDEEM' | 'BONUS', newBalance: number) {
  const data = await getCustomerData(customerId);
  const mobile = data.mobile;
  const firstName = data.firstName || 'Customer';
  if (!mobile) throw new Error('Customer mobile number is missing');
  const msg = `Cajun Life Cafe: Hi ${firstName}, your Cajun Wallet balance is ฿${newBalance.toLocaleString()} after your recent visit. Thank you!`;
  return sendSMSToBackend(formatToE164(mobile), msg);
}

export async function sendReceiptSMS(customerId: string, amount: number, newBalance: number) {
  const data = await getCustomerData(customerId);
  const firstName = data.firstName || 'Customer';
  const mobile = data.mobile;
  const msg = `Hi ${firstName}! Your Cajun Life Cafe bill of ฿${amount} has been processed. Remaining wallet balance: ฿${newBalance.toLocaleString()}. Thank you!`;
  return sendSMSToBackend(formatToE164(mobile), msg);
}

export async function sendTopUpSMS(customerId: string, cash: number, totalPoints: number, bonus: number, newBalance: number) {
  const data = await getCustomerData(customerId);
  const firstName = data.firstName || 'Customer';
  const mobile = data.mobile;
  const msg = `Thank you for your payment of ฿${cash} at Cajun Life Cafe! We've added ฿${totalPoints.toLocaleString()} to your wallet (includes ฿${bonus} bonus). New balance: ฿${newBalance.toLocaleString()}.`;
  return sendSMSToBackend(formatToE164(mobile), msg);
}
