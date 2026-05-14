import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

/**
 * Converts a Thailand mobile number (e.g., 0859459689) to E.164 format (+66859459689)
 * Strip leading 0 and add +66.
 */
function formatToE164(mobile: string): string {
  // Strip any non-digit characters
  const digits = mobile.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    return `+66${digits.slice(1)}`;
  }
  if (!digits.startsWith('66')) {
    return `+66${digits}`;
  }
  return `+${digits}`;
}

/**
 * Internal helper to send OTP via the local server proxy.
 */
async function sendOTPToBackend(to: string) {
  const response = await fetch('/api/send-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ to })
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to send OTP via server');
  }
  return result;
}

/**
 * Internal helper to verify OTP via the local server proxy.
 */
async function verifyOTPWithBackend(to: string, code: string) {
  const response = await fetch('/api/verify-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ to, code })
  });

  const result = await response.json();
  return result;
}

/**
 * Internal helper to send SMS via the local server proxy to avoid CORS issues.
 */
async function sendSMSToBackend(to: string, message: string) {
  const response = await fetch('/api/send-sms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ to, body: message })
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Failed to send SMS via server');
  }
  return result;
}

/**
 * Initiates the Twilio Verify process for a customer.
 * @param mobile The mobile number of the customer
 */
export async function sendVerificationCode(mobile: string) {
  const formattedMobile = formatToE164(mobile);

  // 2. Call server proxy to initiate Twilio Verify
  return await sendOTPToBackend(formattedMobile);
}

/**
 * Internal helper to fetch customer data from either CRM or Loyalty collections
 */
async function getCustomerData(customerId: string) {
  const crmDoc = await getDoc(doc(db, 'crm_customers', customerId));
  if (crmDoc.exists()) return crmDoc.data();
  
  const loyaltyDoc = await getDoc(doc(db, 'loyalty_customers', customerId));
  if (loyaltyDoc.exists()) return loyaltyDoc.data();
  
  throw new Error('Customer not found');
}

/**
 * Sends a balance update SMS notification to a customer.
 */
export async function sendBalanceUpdate(customerId: string, amount: number, type: 'TOP_UP' | 'REDEEM' | 'BONUS', newBalance: number) {
  const customerData = await getCustomerData(customerId);
  const mobile = customerData.mobile || customerData.mobileNumber;
  const firstName = customerData.firstName || customerData.name?.split(' ')[0] || 'Customer';

  if (!mobile) {
    throw new Error('Customer mobile number is missing');
  }

  const formattedMobile = formatToE164(mobile);
  const messageText = `Cajun Life Cafe: Hi ${firstName}, your Cajun Wallet balance is ${newBalance} points after your recent visit. Thank you!`;

  return await sendSMSToBackend(formattedMobile, messageText);
}

/**
 * Sends an SMS when a receipt is processed (deduction).
 */
export async function sendReceiptSMS(customerId: string, amount: number, newBalance: number) {
  const customerData = await getCustomerData(customerId);
  const firstName = customerData.firstName || customerData.name?.split(' ')[0] || 'Customer';
  const mobile = customerData.mobile || customerData.mobileNumber;
  const formattedMobile = formatToE164(mobile);
  
  const messageText = `Hi ${firstName}! Your Cajun Life Cafe bill of ฿${amount} has been processed. Your remaining Cajun Wallet balance is ${newBalance} points. Thank you!`;
  return await sendSMSToBackend(formattedMobile, messageText);
}

/**
 * Sends an SMS when a wallet is topped up with a bonus.
 */
export async function sendTopUpSMS(customerId: string, cash: number, totalPoints: number, bonus: number, newBalance: number) {
  const customerData = await getCustomerData(customerId);
  const firstName = customerData.firstName || customerData.name?.split(' ')[0] || 'Customer';
  const mobile = customerData.mobile || customerData.mobileNumber;
  const formattedMobile = formatToE164(mobile);
  
  const messageText = `Thank you for your payment of ฿${cash} at Cajun Life Cafe! We've added ${totalPoints} points to your Cajun Wallet (includes ${bonus} bonus points). New balance: ${newBalance} points. Enjoy!`;
  return await sendSMSToBackend(formattedMobile, messageText);
}

/**
 * Validates the OTP code using Twilio Verify API.
 * @param customerId The Firestore document ID of the customer
 * @param code The 6-digit code provided by the user
 */
export async function verifyOTPCode(customerId: string, code: string) {
  // 1. Fetch customer from CRM to get mobile number
  const customerDoc = await getDoc(doc(db, 'crm_customers', customerId));
  if (!customerDoc.exists()) {
    return { success: false, message: 'Customer not found' };
  }

  const customerData = customerDoc.data();
  const mobile = customerData.mobile;
  if (!mobile) {
    return { success: false, message: 'Customer mobile number is missing' };
  }

  const formattedMobile = formatToE164(mobile);

  // 2. Call server proxy to verify code with Twilio
  const result = await verifyOTPWithBackend(formattedMobile, code);
  
  if (result.success) {
    // Optional: Log success or update a verified flag in Firestore if needed
    // The user's previous request had Firestore storage for OTPs, but Verify handles the state.
    // If you still want to track "Verified: true" per customer, do it here.
    const crmDocRef = doc(db, 'crm_customers', customerId);
    await updateDoc(crmDocRef, {
      isVerified: true,
      verifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  return result;
}
