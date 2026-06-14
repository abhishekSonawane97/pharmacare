export type Role = 'admin' | 'employee';
export type UserStatus = 'pending' | 'active' | 'rejected';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  status: UserStatus;
  lastActive: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MedicineItem {
  medicineName: string;
  dosage?: string;
}

export interface Customer {
  _id: string;
  name: string;
  phone: string;
  altPhone?: string;
  address?: string;
  notes?: string;
  medicines: MedicineItem[];
  nextDueDate: string;
  isActive: boolean;
  reminderIgnored: boolean;
  autoReminderSentForCycle: boolean;
  autoReminderSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  _id: string;
  customerId: string | { _id: string; name?: string; phone?: string } | null;
  type: 'received' | 'given';
  amount: number;
  date: string;
  notes?: string;
  walkIn: boolean;
  walkInName?: string;
  walkInPhone?: string;
  due: boolean;
  recordedBy: string;
  createdAt: string;
}

export interface Medicine {
  _id: string;
  name: string;
  content?: string;
  category?: string;
  location?: string;
  type?: 'tab' | 'cap' | 'tab_cap' | 'syrup' | 'drops' | 'cream_lotion' | 'ayurvedic' | 'dypers' | 'other';
  inStock: boolean;
  purchasePrice?: number;
  mrp?: number;
  discountedPrice?: number;
  addedFrom?: 'manual' | 'bill';
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  _id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Settings {
  _id: string;
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPhone: string;
  defaultRefillCycleDays: number;
  messageTemplateReminder: string;
  messageTemplateThankYou: string;
}

export interface ReminderLinks {
  message: string;
  whatsappUrl: string;
  smsUrl: string;
}

export interface ReminderRow extends Customer {
  links: ReminderLinks;
}
