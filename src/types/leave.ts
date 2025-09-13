export type LeaveType = 'annual' | 'sick' | 'unpaid' | 'maternity' | 'paternity' | 'other';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeAvatar?: string;
  startDate: string;
  endDate: string;
  days: number;
  type: LeaveType;
  reason?: string;
  status: LeaveStatus;
  requestedOn: string;
  processedOn?: string;
  processedBy?: string;
  comments?: string;
}

export interface LeaveBalance {
  annualEntitlement: number;
  used: number;
  remaining: number;
  lastUpdated: string;
  details?: {
    type: LeaveType;
    total: number;
    used: number;
    remaining: number;
  }[];
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  type: 'public' | 'company';
  description?: string;
}

export interface TeamLeaveCalendar {
  employeeId: string;
  employeeName: string;
  employeeAvatar?: string;
  leaves: {
    id: string;
    startDate: string;
    endDate: string;
    type: LeaveType;
    status: LeaveStatus;
  }[];
}
