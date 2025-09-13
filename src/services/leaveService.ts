import axios from 'axios';
import { getAuthHeader } from '../utils/auth';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

interface LeaveRequestData {
  startDate: string;
  endDate: string;
  leaveType: string;
  reason: string;
}

export const getLeaveBalance = async () => {
  try {
    const response = await axios.get(`${API_URL}/leaves/balance`, {
      headers: getAuthHeader(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    throw error;
  }
};

export const getLeaveHistory = async (params: {
  page?: number;
  pageSize?: number;
  employeeId?: string;
  status?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}) => {
  try {
    const response = await axios.get(`${API_URL}/leaves/history`, {
      params,
      headers: getAuthHeader(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching leave history:', error);
    throw error;
  }
};

export const requestLeave = async (data: LeaveRequestData) => {
  try {
    const response = await axios.post(`${API_URL}/leaves/request`, data, {
      headers: getAuthHeader(),
    });
    return response.data;
  } catch (error) {
    console.error('Error requesting leave:', error);
    throw error;
  }
};

export const getTeamLeaveCalendar = async (params: {
  startDate: string;
  endDate: string;
  managerId: string;
}) => {
  try {
    const response = await axios.get(`${API_URL}/leaves/team-calendar`, {
      params,
      headers: getAuthHeader(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching team leave calendar:', error);
    throw error;
  }
};

export const calculateWorkingDays = async (startDate: string, endDate: string) => {
  try {
    const response = await axios.get(`${API_URL}/leaves/calculate-working-days`, {
      params: { startDate, endDate },
      headers: getAuthHeader(),
    });
    return response.data;
  } catch (error) {
    console.error('Error calculating working days:', error);
    throw error;
  }
};

export const updateLeaveStatus = async (leaveId: string, status: string, comments?: string) => {
  try {
    const response = await axios.put(
      `${API_URL}/leaves/${leaveId}/status`,
      { status, comments },
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating leave status:', error);
    throw error;
  }
};

export const cancelLeaveRequest = async (leaveId: string) => {
  try {
    const response = await axios.put(
      `${API_URL}/leaves/${leaveId}/cancel`,
      {},
      { headers: getAuthHeader() }
    );
    return response.data;
  } catch (error) {
    console.error('Error canceling leave request:', error);
    throw error;
  }
};
