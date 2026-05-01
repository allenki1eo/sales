export interface User {
  id: number;
  username: string;
  full_name: string;
  role: "admin" | "accountant" | "sales_officer";
  signature_path?: string;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string;
  location: string;
  phone: string;
  is_export: boolean;
  charges_efd: boolean;
  efd_profit_per_carton: number;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  default_price: number;
  carton_weight: number;
  created_at: string;
}

export interface CustomerPrice {
  id: number;
  customer_id: number;
  product_id: number;
  price: number;
  product_name?: string;
  default_price?: number;
}

export interface RequestItem {
  id?: number;
  request_id?: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  carton_weight?: number;
}

export interface RequestSignature {
  id: number;
  request_id: number;
  signature_type: "prepared_by" | "requested_by" | "authorised_by" | "approved_by";
  user_id: number;
  user_name?: string;
  signature_path?: string;
  signed_at: string;
}

export interface SalesRequest {
  id: number;
  customer_id: number;
  customer_name?: string;
  customer_location?: string;
  is_export?: boolean;
  charges_efd?: boolean;
  efd_profit_per_carton?: number;
  user_id: number;
  user_name?: string;
  truck_number: string;
  driver_name: string;
  route: string;
  vat_percentage: number;
  status: "pending" | "approved" | "dispatched" | "rejected";
  created_at: string;
  updated_at: string;
  items?: RequestItem[];
  signatures?: RequestSignature[];
  subtotal?: number;
  vat_amount?: number;
  efd_charge?: number;
  total?: number;
  total_weight?: number;
}

export interface DashboardStats {
  pending_requests: number;
  approved_requests: number;
  total_customers: number;
  total_products: number;
  total_revenue: number;
  monthly_revenue: number;
  monthly_cartons: number;
}

export interface MonthlySales {
  month: string;
  revenue: number;
  cartons: number;
}

export interface TopProduct {
  product_id: number;
  product_name: string;
  total_revenue: number;
  total_cartons: number;
}

export interface TopCustomer {
  customer_id: number;
  customer_name: string;
  total_revenue: number;
  total_orders: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
