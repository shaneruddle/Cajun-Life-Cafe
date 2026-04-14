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
  price2?: string;
  price3?: string;
  price4?: string;
  category: string;
  image?: string;
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
  role: 'admin' | 'manager' | 'staff' | 'cashier' | 'user';
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
}

export interface SystemLog {
  id?: string;
  action: string;
  details: string;
  userEmail: string;
  userId: string;
  timestamp: string;
  category: 'menu' | 'category' | 'custom_meal' | 'finance' | 'user' | 'system' | 'image';
}
