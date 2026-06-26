// Shared TypeScript types for VD's Hunger Hub Admin Panel

export type MealType = "LUNCH" | "DINNER";

// ─────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────
export interface Admin {
  id: string;
  name: string;
  number: string;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────
// COMPANY
// ─────────────────────────────────────────
export interface Company {
  id: string;
  name: string;
  location?: string | null;
  isActive: boolean;
  _count?: { users: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyInput {
  name: string;
  location?: string;
}

export interface UpdateCompanyInput {
  name?: string;
  location?: string;
  isActive?: boolean;
}

// ─────────────────────────────────────────
// USER
// ─────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  number: string;
  companyId: string;
  company?: Company;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  name: string;
  number: string;
  companyId: string;
}

export interface UpdateUserInput {
  name?: string;
  number?: string;
  companyId?: string;
  isActive?: boolean;
}

export interface BulkUserRow {
  name: string;
  number: string;
  company_name: string;
}

export interface BulkUserValidated extends BulkUserRow {
  companyId?: string;
  error?: string;
  valid: boolean;
}

// ─────────────────────────────────────────
// PRODUCT
// ─────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
  quantity: string;
  price: number;
  isActive: boolean;
  isAddOnAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  name: string;
  nameGu?: string | null;
  quantity: string;
  price: number;
  isAddOnAvailable?: boolean;
}

export interface UpdateProductInput {
  name?: string;
  nameGu?: string | null;
  quantity?: string;
  price?: number;
  isActive?: boolean;
  isAddOnAvailable?: boolean;
}

// ─────────────────────────────────────────
// THALI CATEGORY
// ─────────────────────────────────────────
export interface ThaliCategory {
  id: string;
  name: string;
  nameGu?: string | null;
  isActive: boolean;
  thalis?: Thali[];
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────
// THALI
// ─────────────────────────────────────────
export interface ThaliItem {
  id: string;
  itemName: string;
  sortOrder: number;
}

export interface Thali {
  id: string;
  name: string;
  nameGu?: string | null;
  price: number;
  description?: string | null;
  sabjiCount: number;
  categoryId?: string | null;
  category?: ThaliCategory | null;
  isActive: boolean;
  items: ThaliItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateThaliInput {
  name: string;
  price: number;
  description?: string;
  sabjiCount: number;
  categoryId?: string | null;
  items: string[]; // array of item names
}

export interface UpdateThaliInput extends Partial<CreateThaliInput> {
  isActive?: boolean;
}

// ─────────────────────────────────────────
// STAFF
// ─────────────────────────────────────────
export interface Staff {
  id: string;
  name: string;
  number: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStaffInput {
  name: string;
  number: string;
}

export interface UpdateStaffInput {
  name?: string;
  number?: string;
  isActive?: boolean;
}

// ─────────────────────────────────────────
// DAILY MENU
// ─────────────────────────────────────────
export interface SabjiOption {
  categoryId: string;
  productIds: string[];
}

export interface DailyMenuThali {
  id: string;
  menuId: string;
  thaliId: string;
  thali: Thali;
}

export interface DailyMenuSabjiOption {
  id: string;
  menuId: string;
  categoryId: string;
  productId: string;
  category?: ThaliCategory | null;
  product: Product;
}

export interface DailyMenu {
  id: string;
  date: string;
  mealType: MealType;
  cutoffTime?: string | null;
  thalis: DailyMenuThali[];
  sabjiOptions: DailyMenuSabjiOption[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDailyMenuInput {
  date: string; // YYYY-MM-DD
  mealType: MealType;
  cutoffTime?: string;
  thaliIds: string[];
  sabjiOptions: SabjiOption[];
}

export interface UpdateDailyMenuInput extends Partial<CreateDailyMenuInput> {}

// ─────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────
export interface DashboardStats {
  companies: number;
  users: number;
  products: number;
  thalis: number;
  staff: number;
  todayMenus: {
    lunch: DailyMenu | null;
    dinner: DailyMenu | null;
  };
}

// ─────────────────────────────────────────
// API RESPONSES
// ─────────────────────────────────────────
export interface ApiError {
  error: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
