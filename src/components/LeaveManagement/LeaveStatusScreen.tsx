import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import Container from "@mui/material/Container";
import {} from "@mui/icons-material";
import { format } from "date-fns";
import axios from "axios";
import { getAuthHeader } from "../../utils/auth";
import {
  getLeaveRequests,
  getLeaveTypes,
  updateLeaveStatus,
} from "../../services/leaveService";

type ApiRow = {
  int_con?: number | string;
  id?: number | string;
  id_can?: number | string;
  code?: string;
  date_depart?: string;
  date_end?: string;
  nbr_jour?: number;
  state?: string;
  date_creation?: string;
  submittedDate?: string;
  comments?: string;
  COMMENT?: string;
  Cause?: string;
};

type LeaveRequest = {
  id: string | number;
  type: string; // mapped like 'EL - Emergency Leave'
  startDate: string;
  endDate: string;
  days: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  submittedDate: string;
  reviewedBy?: string;
  reviewedAt?: string;
  comments?: string;
};

const LeaveStatusScreen: React.FC<{ employeeId?: number | string }> = ({
  employeeId,
}) => {
  const { t } = useTranslation();
  const API_URL = process.env.REACT_APP_API_IP;
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypeMap, setLeaveTypeMap] = useState<
    Record<string, { code: string; name: string }>
  >({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Delegation fallback state
  const [employees, setEmployees] = useState<any[]>([]);
  const [delegatesLoading, setDelegatesLoading] = useState(false);
  const [selectedDelegateId, setSelectedDelegateId] = useState<
    string | number | ""
  >("");
  const [showDelegatePicker, setShowDelegatePicker] = useState(false);

  const fetchLeaveRequestsCb = useCallback(async () => {
    try {
      setLoading(true);
      const [types, data]: [any[], ApiRow[]] = await Promise.all([
        getLeaveTypes(),
        getLeaveRequests(String(employeeId ?? "")),
      ]);

      // Build map { int_can: { code, name } }
      const typeMap: Record<string, { code: string; name: string }> = {};
      (Array.isArray(types) ? types : []).forEach((t: any) => {
        if (t && t.int_can != null) {
          typeMap[String(t.int_can)] = {
            code: String(t.code || ""),
            name: String(t.desig_can || ""),
          };
        }
      });
      setLeaveTypeMap(typeMap);

      // 'data' is already normalized by the service: { id, type, startDate, endDate, days, status, submittedDate, comments, idCan }
      const normalized: LeaveRequest[] = (Array.isArray(data) ? data : []).map(
        (item: any) => {
          const idCan = item.idCan != null ? String(item.idCan) : undefined;
          const m = idCan ? typeMap[idCan] : undefined;
          const enhancedType = m
            ? `${m.code} - ${m.name}`
            : String(item.type ?? "");
          return {
            id: item.id,
            type: enhancedType,
            startDate: item.startDate,
            endDate: item.endDate,
            days: item.days,
            status: item.status as LeaveRequest["status"],
            submittedDate: item.submittedDate,
            comments: item.comments,
          } as LeaveRequest;
        }
      );
      setLeaveRequests(normalized);
    } catch (err) {
      setError(t("leave.status.fetchError"));
      console.error("Error fetching leave requests:", err);
    } finally {
      setLoading(false);
    }
  }, [t, employeeId]);

  useEffect(() => {
    fetchLeaveRequestsCb();
  }, [fetchLeaveRequestsCb]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "success";
      case "rejected":
        return "error";
      case "cancelled":
        return "default";
      default:
        return "warning";
    }
  };

  // Pending (requested time off) only
  const requested = leaveRequests.filter((r) => r.status === "pending");

  // Moderation dialog state
  const [actionOpen, setActionOpen] = useState(false);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const openActionDialog = (req: LeaveRequest) => {
    setSelected(req);
    setActionError(null);
    setSelectedDelegateId("");
    setShowDelegatePicker(false);
    setActionOpen(true);
  };
  const closeActionDialog = () => {
    setActionOpen(false);
    setSelected(null);
    setActionError(null);
  };

  const onModerate = async (status: "approved" | "rejected" | "cancelled") => {
    if (!selected) return;
    try {
      setActionLoading(true);
      setActionError(null);
      await updateLeaveStatus(String(selected.id), status);
      // If approved, notify HR and delegate via backend endpoint
      let emailFailed = false;
      if (status === "approved") {
        // If the delegate picker is shown, require a selection before attempting to send
        if (showDelegatePicker && !selectedDelegateId) {
          setActionError(
            t(
              "leave.delegate.required",
              "Please select a delegate before sending."
            )
          );
          setActionLoading(false);
          return; // keep dialog open
        }
        try {
          const inferredBase = `${window.location.protocol}//${window.location.hostname}:9000`;
          const base = (
            API_URL && API_URL.trim() ? API_URL : inferredBase
          ).replace(/\/+$/, "");
          const headers = await getAuthHeader();
          await axios.post(
            `${base}/holidays/send-delegate`,
            {
              id_emp: employeeId,
              date_start: selected.startDate,
              date_end: selected.endDate,
              comment: selected.comments || undefined,
              delegate_id: selectedDelegateId || undefined,
            },
            { headers }
          );
        } catch (e) {
          // Non-blocking: surface error and show delegate picker if relevant
          const msg =
            (e as any)?.response?.data?.message ||
            (e as any)?.message ||
            "Delegation email failed";
          setActionError(msg);
          if (/No delegate found/i.test(String(msg)))
            setShowDelegatePicker(true);
          emailFailed = true;
        }
      }
      await fetchLeaveRequestsCb();
      // If delegation email failed after approval, keep dialog open so user can pick a delegate
      if (!(status === "approved" && emailFailed)) {
        closeActionDialog();
      }
    } catch (e: any) {
      setActionError(
        e?.response?.data?.message || e?.message || "Action failed"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const sendDelegationEmail = async () => {
    if (!selected) return;
    try {
      setActionLoading(true);
      setActionError(null);
      const inferredBase = `${window.location.protocol}//${window.location.hostname}:9000`;
      const base = (API_URL && API_URL.trim() ? API_URL : inferredBase).replace(
        /\/+$/,
        ""
      );
      const headers = await getAuthHeader();
      await axios.post(
        `${base}/holidays/send-delegate`,
        {
          id_emp: employeeId,
          date_start: selected.startDate,
          date_end: selected.endDate,
          comment: selected.comments || undefined,
          delegate_id: selectedDelegateId || undefined,
        },
        { headers }
      );
    } catch (e: any) {
      setActionError(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to send delegation email"
      );
      if (
        /No delegate found/i.test(
          String(e?.response?.data?.message || e?.message)
        )
      )
        setShowDelegatePicker(true);
    } finally {
      setActionLoading(false);
    }
  };

  // Load employees for delegate dropdown when dialog opens or when needed
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        setDelegatesLoading(true);
        const inferredBase = `${window.location.protocol}//${window.location.hostname}:9000`;
        const base = (
          API_URL && API_URL.trim() ? API_URL : inferredBase
        ).replace(/\/+$/, "");
        const headers = await getAuthHeader();
        const res = await axios.get(`${base}/employees`, { headers });
        const arr = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setEmployees(arr);
      } catch {
        setEmployees([]);
      } finally {
        setDelegatesLoading(false);
      }
    };
    if (actionOpen && employees.length === 0) {
      loadEmployees();
    }
  }, [actionOpen, API_URL, employees.length]);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="60vh"
      >
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Box mt={2}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Container>
      <Card>
        <CardHeader title={t("leave.status.title")} />
        <CardContent>
          {/* Requested time off */}
          <Box>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("leave.status.type")}</TableCell>
                    <TableCell>{t("leave.status.period")}</TableCell>
                    <TableCell align="right">
                      {t("leave.status.days")}
                    </TableCell>
                    <TableCell>{t("leave.status.submitted")}</TableCell>
                    <TableCell>{t("leave.status.actions")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requested.length ? (
                    requested.map((request) => (
                      <TableRow key={`req-${String(request.id)}`} hover>
                        <TableCell>{request.type}</TableCell>
                        <TableCell>
                          {request.startDate
                            ? format(new Date(request.startDate), "MMM d, yyyy")
                            : "-"}{" "}
                          -{" "}
                          {request.endDate
                            ? format(new Date(request.endDate), "MMM d, yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell align="right">{request.days}</TableCell>
                        <TableCell>
                          {request.submittedDate
                            ? format(
                                new Date(request.submittedDate),
                                "MMM d, yyyy"
                              )
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={t(`leave.status.${request.status}`)}
                            color={getStatusColor(request.status)}
                            variant="outlined"
                            size="small"
                            sx={{ mr: 1 }}
                          />
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            sx={{ mr: 1 }}
                            onClick={() => openActionDialog(request)}
                          >
                            {t("common.review", "Review")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 2 }}>
                        <Typography variant="body2" color="textSecondary">
                          {t("leave.status.noPending", "No pending requests")}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </CardContent>
      </Card>
      <Dialog
        open={actionOpen}
        onClose={closeActionDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t("leave.moderate.title", "Review Leave Request")}
        </DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t("leave.status.type", "Type")}: {selected.type}
              </Typography>
              <Typography variant="body2" gutterBottom>
                {t("leave.status.period", "Period")}:{" "}
                {selected.startDate
                  ? format(new Date(selected.startDate), "MMM d, yyyy")
                  : "-"}{" "}
                -{" "}
                {selected.endDate
                  ? format(new Date(selected.endDate), "MMM d, yyyy")
                  : "-"}
              </Typography>
              <Typography variant="body2" gutterBottom>
                {t("leave.status.days", "Days")}: {selected.days}
              </Typography>
              {selected.comments && (
                <Typography variant="body2" color="text.secondary">
                  {t("leave.status.comments", "Comments")}: {selected.comments}
                </Typography>
              )}
            </Box>
          )}
          {showDelegatePicker && (
            <Box mt={2}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {t("leave.delegate.select", "Select Delegate")}
                </InputLabel>
                <Select
                  label={t("leave.delegate.select", "Select Delegate")}
                  value={selectedDelegateId}
                  onChange={(e) => setSelectedDelegateId(e.target.value as any)}
                  disabled={delegatesLoading}
                >
                  <MenuItem value="">
                    <em>{t("common.select", "Select")}</em>
                  </MenuItem>
                  {employees.map((e: any) => (
                    <MenuItem
                      key={e.ID_EMP ?? e.id ?? e.id_emp}
                      value={e.ID_EMP ?? e.id ?? e.id_emp}
                    >
                      {`${e.NAME || e.NAME_ENGLISH || ""}${e.TITLE ? " - " + e.TITLE : ""}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">
                {t(
                  "leave.delegate.helper",
                  "No default delegate found. Pick one and resend the email."
                )}
              </Typography>
            </Box>
          )}
          {actionError && (
            <Box mt={2}>
              <Alert severity="error">{actionError}</Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            disabled={actionLoading}
            onClick={sendDelegationEmail}
            color="info"
          >
            {t("leave.delegate.send", "Send Delegation Email")}
          </Button>
          <Button onClick={closeActionDialog}>
            {t("common.close", "Close")}
          </Button>
          <Button
            disabled={actionLoading}
            color="error"
            onClick={() => onModerate("cancelled")}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            disabled={actionLoading}
            color="error"
            variant="outlined"
            onClick={() => onModerate("rejected")}
          >
            {t("common.reject", "Reject")}
          </Button>
          <Button
            disabled={actionLoading}
            color="success"
            variant="contained"
            onClick={() => onModerate("approved")}
          >
            {t("common.approve", "Approve")}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default LeaveStatusScreen;
