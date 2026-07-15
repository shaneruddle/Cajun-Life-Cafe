export interface MenuItem {
  id?: string;
  name: string;
  name_chinese?: string;
  name_russian?: string;
  name_thai?: string;
  description: string;
  description_chinese?: string;
  description_russian?: string;
  description_thai?: string;
  price: string;
  priceLabel?: string;
  price2?: string;
  price2Label?: string;
  price3?: string;
  price3Label?: string;
  price4?: string;
  price4Label?: string;
  category: string;
  image?: string;
  primaryPhotoPath?: string;
  secondaryPhotoPath?: string;
  secondaryImage?: string;
  highResImage?: string;
  socialImage?: string;
  promoImages?: string[];
  published: boolean;
  order: number;
  uid?: string;
}

export interface CustomMealOption {
  weight: string;
  price: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface CustomMealItem {
  id?: string;
  name: string;
  type: string;
  description?: string;
  order: number;
  options: CustomMealOption[];
  uid?: string;
}

export interface SelectedIngredient {
  itemId: string;
  itemName: string;
  option: CustomMealOption;
}

export interface Category {
  id?: string;
  name: string;
  order: number;
  uid?: string;
}

export interface UserProfile {
  id?: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'marketing' | 'cashier' | 'manager' | 'employee';
  createdAt: string;
  lastLogin?: string;
  uid: string;
}

export type OperationType = 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export interface FinanceCategory {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'dividend';
  uid: string;
}

export interface LineItem {
  description: string;
  amount: number;
  quantity?: number;
  weight?: string;
}

export interface FinanceEntry {
  id: string;
  type: 'income' | 'expense' | 'dividend';
  amount: number;
  categoryId: string;
  categoryName: string;
  description: string;
  date: string;
  createdBy: string;
  createdAt: string;
  uid: string;
  receiptUrls?: string[];
  lineItems?: LineItem[];
  employeeId?: string;
  employeeName?: string;
}

export interface SystemLog {
  id?: string;
  action: string;
  details: string;
  userEmail: string;
  userId: string;
  timestamp: string;
  category: 'menu' | 'category' | 'custom_meal' | 'finance' | 'user' | 'system' | 'image' | 'crm' | 'loyalty' | 'job';
}

// Single unified customer record — lives in crm_customers collection.
// Loyalty fields are optional; they become populated when staff clicks "Enroll".
export interface CRMCustomer {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  notes?: string;
  lastVisit?: string;
  totalSpend: number;
  status: 'active' | 'inactive';
  uid: string;
  createdAt: string;
  updatedAt: string;
  // Address & delivery
  address?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryNotes?: string;
  // Loyalty fields — present once enrolled
  loyaltyEnabled?: boolean;
  balance?: number;
  lineUserId?: string;
  isVerified?: boolean;
}

export interface LoyaltyTransactionItem {
  name: string;
  qty: number;
  price: number;
}

export interface LoyaltyTransaction {
  id: string;
  type: 'TOP_UP' | 'REDEEM' | 'BONUS';
  amount: number;
  bonus?: number;
  timestamp: any;
  details: string;
  receiptUrl?: string;
  memo?: string;
  items?: LoyaltyTransactionItem[];
}

export interface Employee {
  id?: string;
  firstName: string;
  lastName: string;
  baseSalary: number;
  position: string;
  startDate: string;
  bankBranch: string;
  bankAccountNumber: string;
  uid: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollSummary {
  id?: string;
  month: string; // yyyy-MM
  employeeId: string;
  employeeName: string;
  position: string;
  baseSalary: number;
  advances: number;
  deductions: number;
  bonuses: number;
  totalDue: number;
  status: 'pending' | 'paid';
  createdAt: string;
  updatedAt: string;
  uid: string;
}

// Job postings — managed from /dashboard/jobs (Admin + Manager) and shown
// publicly on /careers when status is 'open'. `department` uses the same
// canonical English values as the application form's role dropdown on
// CareersPage.tsx so a listing can pre-fill that dropdown on "Apply".
export interface Job {
  id?: string;
  title: string;
  titleThai?: string;
  department: string;
  employmentType: 'Full-time' | 'Part-time';
  description: string;
  descriptionThai?: string;
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  uid?: string;
}
