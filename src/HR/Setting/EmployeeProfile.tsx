// src/Profile/HR/Employees.tsx
/* eslint-disable */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import type { SelectChangeEvent } from "@mui/material/Select";
import {
  listEmployees,
  listActiveEmployees,
  updateEmployeeTimes,
  isActiveEmployee as inferActiveEmployee,
} from "../../api/employees";
import ScheduleDialog from "../../components/ScheduleDialog";
import {
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Box,
  IconButton,
  Tooltip,
  Button,
  ButtonGroup,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  Avatar,
  Stack,
  Paper,
  Alert,
  Snackbar,
  useMediaQuery,
  useTheme,
  Chip,
  LinearProgress,
  Card,
  Autocomplete,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Divider,
  Switch,
  FormControlLabel,
  InputLabel,
  Radio,
  RadioGroup,
  FormLabel,
  Checkbox,
  FormGroup,
  FormHelperText,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GridViewIcon from "@mui/icons-material/GridView";
import AddIcon from "@mui/icons-material/Add";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import RefreshIcon from "@mui/icons-material/Refresh";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LocalAtmIcon from "@mui/icons-material/LocalAtm";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import BadgeIcon from "@mui/icons-material/Badge";
import ApartmentIcon from "@mui/icons-material/Apartment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import ViewListIcon from '@mui/icons-material/ViewList';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import EditOutlined from '@mui/icons-material/EditOutlined';
import TableRow from '@mui/material/TableRow';
import * as XLSX from "xlsx";
import api from "../../api";
import { useTranslation } from "react-i18next";
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import UsersDialog from "../../Profile/components/UsersDialog";

// Components
import EmployeeCard, {
  EmployeeGrid,
  MinimalEmployee,
} from "../../components/EmployeeCard";
import { EmployeeList } from "../../components/EmployeeList"; // <-- adjust path

// --- Square layout helpers ---
const SquareGrid: React.FC<React.PropsWithChildren<{cols?: number}>> = ({ cols = 2, children }) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: { xs: "1fr", md: `repeat(${cols}, 1fr)` },
      gap: 2,
      alignItems: "stretch",
    }}
  >
    {children}
  </Box>
);

const SquareCard: React.FC<React.PropsWithChildren<{title?: string; minH?: number}>> = ({ title, minH = 160, children }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 2,
      borderRadius: 2,
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-start",
      minHeight: { xs: minH - 20, md: minH },
      overflow: "hidden",
    }}
  >
    {title && (
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
        {title}
      </Typography>
    )}
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>{children}</Box>
  </Paper>
);

type Emp = MinimalEmployee & {
  EMAIL?: string | null;
  PHONE?: string | null;
};

// fixed-width select (no Grid sizing)
const SelectFixedWidth: React.FC<{
  label: string;
  value: any;
  onChange: (v: any) => void;
  w?: 100 | 200;
  children: React.ReactNode;
  name?: string;
}> = ({ label, value, onChange, w = 200, children, name }) => (
  <FormControl sx={{ width: w }}>
    <InputLabel shrink>{label}</InputLabel>
    <Select
      label={label}
      name={name}
      value={value ?? ""}
      onChange={(e) => onChange((e.target as HTMLInputElement).value)}
      displayEmpty
      MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
    >
      {children}
    </Select>
  </FormControl>
);

// fixed-width text input (useful for short fields)
const TextFixedWidth: React.FC<{
  label: string;
  value: any;
  onChange: (v: any) => void;
  type?: string;
  placeholder?: string;
  w?: number;
  name?: string;
  helperText?: string;
  required?: boolean;
  error?: boolean;
}> = ({ label, value, onChange, type, w = 200, name, helperText, required, error, placeholder }) => (
  <TextField
    sx={{ width: w }}
    label={label}
    name={name}
    type={type}
    value={value ?? ""}
    onChange={(e) => onChange((e.target as HTMLInputElement).value)}
    InputLabelProps={{ shrink: true }}
    helperText={helperText}
    required={required}
    error={error}
    placeholder={placeholder}
  />
);

export type Employee = {
  ID_EMP?: number;
  NAME: string;
  FIRST_NAME?: string | null;
  SURNAME?: string | null;
  TITLE?: string | null;
  EMAIL?: string | null;
  PHONE?: string | null;
  STATE?: boolean | null;
  CONTRACT_START?: string | null;
  CONTRACT_END?: string | null;
  BASIC_SALARY?: number | null;
  BASIC_SALARY_USD?: number | null;
  NATIONALITY?: string | null;
  MARITAL_STATUS?: string | null;
  DEGREE?: string | null;
  TYPE_OF_RECRUITMENT?: string | null;
  ADDRESS?: string | null;
  DATE_OF_BIRTH?: string | null;
  GENDER?: string | null;
  NUM_OF_CHILDREN?: number | null;
  PLACE_OF_BIRTH?: string | null;
  BLOOD_TYPE?: string | null;
  PS?: any;
  PICTURE_URL?: string | null;
  PICTURE?: any | null;
  NUM_CIN?: string | null;
  ISSUING_AUTH?: string | null;
  FAM_BOOK_NUM?: string | null;
  FAM_BOOK_ISSUING_AUTH?: string | null;
  PASSPORT_NUM?: string | null;
  PASSPORT_ISSUING_AUTH?: string | null;
  ANNUAL_LEAVE_BAL?: number | null;
  DRIVER_LIC_NUM?: string | null;
  NAME_ENGLISH?: string | null;
  SCIENTIFIC_CERT?: string | null;
  EDUCATION_CERT_URL?: string | null;
  NUM_NATIONAL?: string | null;
  RENEWABLE_CONTRACT?: string | null;
  ATTACHED_NUMBER?: string | null;
  JOB_AIM?: string | null;
  JOB_DESCRIPTION?: string | null;
  JOB_RELATION?: any;
  REQUEST_DEGREE?: string | null;
  PREFERRED_LANG?: string | null;
  MEDICAL_COMMENT?: string | null;
  EMERGENCY_CONTACT_RELATION?: string | null;
  EMERGENCY_CONTACT_PHONE?: string | null;
  MOTHER_NAME_AR?: string | null;
  OUTFIT_NUM?: string | null;
  FOOTWEAR_NUM?: string | null;
  FOOD?: number | null; // daily
  FUEL?: number | null; // daily
  COMMUNICATION?: number | null; // daily
  num_kid?: string | null;
  T_START?: string | null;
  T_END?: string | null;
  GOLD_COMM?: string | null;
  DIAMOND_COMM?: number | null;
  FOOD_ALLOWANCE?: number | null; // daily (legacy field kept)
  GOLD_COMM_VALUE?: number | null;
  DIAMOND_COMM_TYPE?: string | null;
  COST_CENTER?: string | null;
  CREATED_AT?: string | null;
  UPDATED_AT?: string | null;
  IS_FOREINGHT?: boolean | null;
  FINGERPRINT_NEEDED?: boolean | null;
  COMMENT?: string | null;
  EMPLOYER_REF?: string | null;
  BANK?: number | null;
  INVESTMENT?: string | null;
  FINANCE_NUM?: string | null;
  TYPE_OF_INSURANCE?: string | null;
  NUM_OF_INSURANCE?: string | null;
  ACCOUNT_NUMBER?: string | null;
};

// Central helper: determine whether an employee is considered "active".
const normalizeBoolean = (val: unknown): boolean | undefined => {
  if (val === undefined || val === null || val === "") return undefined;
  if (typeof val === "boolean") return val;
  if (typeof val === "number") {
    if (Number.isNaN(val)) return undefined;
    return val !== 0;
  }
  const lowered = String(val).trim().toLowerCase();
  if (!lowered) return undefined;
  if (["active", "true", "yes", "y", "1"].includes(lowered)) return true;
  if (["inactive", "false", "no", "n", "0"].includes(lowered)) return false;
  return undefined;
};

const safeInferActive = (e: Employee): boolean | undefined => {
  try {
    return inferActiveEmployee(e);
  } catch {
    return undefined;
  }
};

const contractVerdict = (e: Employee): boolean | undefined => {
  const endLike =
    e.T_END ??
    e.CONTRACT_END ??
    (e as any).contract_end ??
    (e as any).CONTRACT_END ??
    (e as any).contractEnd;
  if (!endLike) return undefined;
  const end = new Date(String(endLike));
  if (!Number.isFinite(end.getTime())) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return end.getTime() >= today.getTime();
};

const isActiveEmployee = (e: Employee): boolean => {
  const stateVerdict =
    normalizeBoolean(e.STATE) ??
    normalizeBoolean((e as any).state) ??
    normalizeBoolean((e as any).ACTIVE) ??
    normalizeBoolean((e as any).active);
  if (stateVerdict === false) return false;

  const statusVerdict =
    normalizeBoolean((e as any).STATUS) ??
    normalizeBoolean((e as any).Status) ??
    normalizeBoolean((e as any).status);
  if (statusVerdict === false) return false;

  const explicitVerdict =
    stateVerdict ?? statusVerdict ?? contractVerdict(e);

  if (explicitVerdict === undefined) {
    // No explicit signals -> treat as inactive by default
    return false;
  }

  const inferred = safeInferActive(e);
  if (explicitVerdict === true && inferred === false) return false;
  return explicitVerdict;
};

export type ScheduleSlot = {
  day:
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday"
    | "Sunday";
  timeSlots: Array<{
    start: string;
    end: string;
    type: "Employment" | "Education";
    note?: string;
  }>;
};

export type JobRow = {
  id_job: number;
  job_name: string;
  year_job: number;
  Job_degree: number;
  Job_level: string;
  Job_title: string;
  Job_code: string;
  job_categories: string;
};

const emptyEmployee: Employee = {
  NAME: "",
  FIRST_NAME: "",
  SURNAME: "",
  TITLE: "",
  EMAIL: "",
  PHONE: "",
  STATE: true,
  CONTRACT_START: "",
  CONTRACT_END: "",
  BASIC_SALARY: null,
  BASIC_SALARY_USD: null,
  NATIONALITY: "",
  MARITAL_STATUS: "",
  DEGREE: "",
  TYPE_OF_RECRUITMENT: "",
  ADDRESS: "",
  DATE_OF_BIRTH: "",
  GENDER: "",
  NUM_OF_CHILDREN: null,
  PLACE_OF_BIRTH: "",
  BLOOD_TYPE: "",
  PS: "",
  COMMENT: "",
  EMPLOYER_REF: "",
  BANK: null,
  INVESTMENT: "",
  FINANCE_NUM: "",
  TYPE_OF_INSURANCE: "",
  NUM_OF_INSURANCE: "",
  ACCOUNT_NUMBER: "",
  PICTURE: null,
  NUM_CIN: "",
  ISSUING_AUTH: "",
  FAM_BOOK_NUM: "",
  FAM_BOOK_ISSUING_AUTH: "",
  PASSPORT_NUM: "",
  PASSPORT_ISSUING_AUTH: "",
  ANNUAL_LEAVE_BAL: null,
  DRIVER_LIC_NUM: "",
  NAME_ENGLISH: "",
  SCIENTIFIC_CERT: "",
  EDUCATION_CERT_URL: "",
  NUM_NATIONAL: "",
  RENEWABLE_CONTRACT: "",
  ATTACHED_NUMBER: "",
  JOB_AIM: "",
  JOB_DESCRIPTION: "",
  JOB_RELATION: "",
  REQUEST_DEGREE: "",
  PREFERRED_LANG: "",
  MEDICAL_COMMENT: "",
  EMERGENCY_CONTACT_RELATION: "",
  EMERGENCY_CONTACT_PHONE: "",
  MOTHER_NAME_AR: "",
  OUTFIT_NUM: "",
  FOOTWEAR_NUM: "",
  FOOD: null,
  FUEL: null,
  COMMUNICATION: null,
  num_kid: "",
  T_START: "",
  T_END: "",
  GOLD_COMM: "",
  DIAMOND_COMM: null,
  FOOD_ALLOWANCE: null,
  GOLD_COMM_VALUE: null,
  DIAMOND_COMM_TYPE: "",
  PICTURE_URL: "",
  IS_FOREINGHT: false,
  FINGERPRINT_NEEDED: false,
  COST_CENTER: "",
};

const steps = [
  "Basic & Personal",
  "Employment + Compensation + Financial",
  "Identification",
  "Other Information",
];

const NATIONALITIES = [
  "Libyan",
  "Egyptian",
  "Tunisian",
  "Algerian",
  "Moroccan",
  "Sudanese",
  "Chadian",
  "Nigerian",
  "Turkish",
  "Italian",
  "French",
  "British",
  "American",
  "Indian",
  "Pakistani",
  "Bangladeshi",
  "Filipino",
  "Syrian",
  "Palestinian",
  "Jordanian",
  "Emirati",
  "Saudi",
  "Qatari",
  "Kuwaiti",
];

const SCIENTIFIC_CERTIFICATES = [
  "High School Diploma",
  "Bachelor's Degree",
  "Master's Degree",
  "PhD",
  "Vocational Certificate",
  "Technical Diploma",
  "Professional Certification",
  "Associate Degree",
];

const apiIp = process.env.REACT_APP_API_IP;
const BASE_URL = `${apiIp || ""}`.replace(/\/+$/, "");
if (BASE_URL) {
  (api as any).defaults.baseURL = BASE_URL;
}
api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("token") || localStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// ===== Helpers =====
const initials = (name?: string | null) =>
  name
    ? name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString() : "—";

const toYMD = (v?: string | null) => {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const currency = (n?: number | null) =>
  n == null
    ? "—"
    : new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "LYD",
        maximumFractionDigits: 0,
      }).format(n);

const labelize = (k: string) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

const isDateKey = (k: string) =>
  /(DATE|_AT|_DATE|_START|_END|T_START|T_END|BIRTH)$/i.test(k);

const BoolChip = ({ value }: { value: boolean }) => {
  const theme = useTheme();
  const ok = value === true;
  return (
    <Chip
      size="small"
      icon={ok ? <CheckCircleIcon /> : <CancelIcon />}
      label={ok ? "Yes" : "No"}
      sx={{
        bgcolor: ok ? theme.palette.success.light : theme.palette.error.light,
        color: ok
          ? theme.palette.success.contrastText
          : theme.palette.error.contrastText,
      }}
    />
  );
};

function normalizeId(x: any): number | undefined {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function employeeKey(e: Employee): string {
  const id = normalizeId(e.ID_EMP);
  if (id) return `id-${id}`;
  const name = String(e.NAME || "")
    .trim()
    .toLowerCase();
  const email = String((e as any).EMAIL || "")
    .trim()
    .toLowerCase();
  const phone = String((e as any).PHONE || "").trim();
  const ps = String((e as any).PS || "").trim();
  return `noid-${name}|${email}|${phone}|${ps}`;
}

function formatPs(ps: any): string | undefined {
  if (ps == null || ps === "") return undefined;
  const s = String(ps).trim();
  if (!s) return undefined;
  const sUp = s.toUpperCase();
  // If it's already like P1/P2/... keep it
  if (/^P[0-9]+$/.test(sUp)) return sUp;
  // If it's purely numeric, prefix with P
  if (/^[0-9]+$/.test(s)) return `P${s}`;
  // Otherwise, return the code uppercased (e.g., OG, HQ)
  return sUp;
}

const SectionHeading: React.FC<React.PropsWithChildren> = ({ children }) => (
  <Typography
    variant="subtitle1"
    sx={{
      mb: 1.25,
      fontWeight: 800,
      color: "text.primary",
      letterSpacing: 0.2,
    }}
  >
    {children}
  </Typography>
);

// ====== Data helpers ======
function dedupeEmployees(list: Employee[]): Employee[] {
  const seen = new Set<string>();
  const out: Employee[] = [];
  for (const e of list) {
    const k = employeeKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

function buildHierarchyAll(employees: Employee[]) {
  const byId = new Map<number, Employee>();
  employees.forEach((e) => {
    const id = normalizeId(e.ID_EMP);
    if (id) byId.set(id, e);
  });
  const children = new Map<number | "root", Employee[]>();
  children.set("root", []);
  employees.forEach((e) => {
    const selfId = normalizeId(e.ID_EMP);
    const mgrId = normalizeId(e.JOB_RELATION);
    if (!selfId) {
      const arr = children.get("root") || [];
      arr.push(e);
      children.set("root", arr);
      return;
    }
    if (mgrId && byId.has(mgrId) && mgrId !== selfId) {
      const arr = children.get(mgrId) || [];
      arr.push(e);
      children.set(mgrId, arr);
    } else {
      const arr = children.get("root") || [];
      arr.push(e);
      children.set("root", arr);
    }
  });
  const byTitleName = (a: Employee, b: Employee) => {
    const ta = (a.TITLE || "").localeCompare(b.TITLE || "");
    if (ta !== 0) return ta;
    return (a.NAME || "").localeCompare(b.NAME || "");
  };
  children.forEach((arr, k) => children.set(k, [...arr].sort(byTitleName)));
  return { byId, children } as const;
}

const OrgCard: React.FC<{ e: Employee; posName?: string }> = ({
  e,
  posName,
}) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        minWidth: 220,
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Avatar
          variant="square"
          src={
            (e.PICTURE_URL ||
              (e.ID_EMP
                ? `http://localhost:9000/api/employees/${e.ID_EMP}/picture`
                : undefined)) as string | undefined
          }
          sx={{
            width: 48,
            height: 48,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            fontSize: 16,
          }}
        />
        <Box>
          <Typography fontWeight={700} lineHeight={1.2}>
            {e.NAME}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {e.TITLE || "—"}
          </Typography>
          {posName && <Chip size="small" sx={{ mt: 0.75 }} label={posName} />}
        </Box>
      </Stack>
    </Paper>
  );
};

const OrgNodeAll: React.FC<{
  node: Employee;
  data: ReturnType<typeof buildHierarchyAll>;
  posNameById: Map<number, string>;
  onSelect: (e: Employee) => void;
  onReassign: (empId: number, newMgrId: number | null) => void;
  depth?: number;
  visited?: Set<number>;
}> = ({
  node,
  data,
  posNameById,
  onSelect,
  onReassign,
  depth = 0,
  visited,
}) => {
  const MAX_DEPTH = 5;
  const MAX_CHILDREN = 20;
  const selfId = normalizeId(node.ID_EMP);
  const visitedNext = new Set<number>(visited || []);
  if (selfId) visitedNext.add(selfId);
  const kidsAll = data.children.get(Number(node.ID_EMP!)) || [];
  const kidsUnique = dedupeEmployees(kidsAll).filter((k) => {
    const id = normalizeId(k.ID_EMP);
    return !id || !visitedNext.has(id);
  });
  const kids = kidsUnique.slice(0, MAX_CHILDREN);
  return (
    <Stack alignItems="center" spacing={2}>
      <Box onClick={() => onSelect(node)}>
        <OrgCard
          e={node}
          posName={formatPs(node.PS)}
        />
      </Box>
      {kids.length > 0 && depth < MAX_DEPTH && (
        <>
          <Box sx={{ width: 2, height: 16, bgcolor: "divider" }} />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box
              sx={{
                height: 2,
                bgcolor: "divider",
                width: "100%",
                maxWidth: kids.length * 260,
              }}
            />
          </Box>
          <Stack
            direction="row"
            spacing={3}
            alignItems="flex-start"
            justifyContent="center"
          >
            {kids.map((c) => (
              <Stack key={employeeKey(c)} alignItems="center" spacing={2}>
                <Box sx={{ width: 2, height: 16, bgcolor: "divider" }} />
                <OrgNodeAll
                  node={c}
                  data={data}
                  posNameById={posNameById}
                  onSelect={onSelect}
                  onReassign={onReassign}
                  depth={depth + 1}
                  visited={visitedNext}
                />
              </Stack>
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
};

const OrgChartAll: React.FC<{
  employees: Employee[];
  posNameById: Map<number, string>;
  onSelect: (e: Employee) => void;
  onReassign: (empId: number, newMgrId: number | null) => void;
}> = ({ employees, posNameById, onSelect, onReassign }) => {
  const src = dedupeEmployees(employees || []);
  const data = buildHierarchyAll(src);
  let roots = data.children.get("root") || [];
  roots = dedupeEmployees(roots);
  if (!roots.length && src.length) {
    roots = src.filter((e) => normalizeId(e.ID_EMP)).slice(0, 100);
  }
  return (
    <Box
      sx={{ p: 2, display: "flex", justifyContent: "center", overflow: "auto" }}
    >
      {roots.length ? (
        roots.length === 1 ? (
          <OrgNodeAll
            node={roots[0]}
            data={data}
            posNameById={posNameById}
            onSelect={onSelect}
            onReassign={onReassign}
            depth={0}
            visited={new Set()}
          />
        ) : (
          <Stack alignItems="center" spacing={2}>
            <Paper
              elevation={0}
              sx={{
                p: 1,
                px: 2,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                Organization
              </Typography>
            </Paper>
            <Box sx={{ width: 2, height: 16, bgcolor: "divider" }} />
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Box
                sx={{
                  height: 2,
                  bgcolor: "divider",
                  width: "100%",
                  maxWidth: roots.length * 280,
                }}
              />
            </Box>
            <Stack
              direction="row"
              spacing={3}
              alignItems="flex-start"
              justifyContent="center"
              flexWrap="wrap"
            >
              {roots.map((r) => (
                <Stack key={employeeKey(r)} alignItems="center" spacing={2}>
                  <Box sx={{ width: 2, height: 16, bgcolor: "divider" }} />
                  <OrgNodeAll
                    node={r}
                    data={data}
                    posNameById={posNameById}
                    onSelect={onSelect}
                    onReassign={onReassign}
                    depth={0}
                    visited={new Set()}
                  />
                </Stack>
              ))}
            </Stack>
          </Stack>
        )
      ) : (
        <Typography variant="body2" color="text.secondary">
          No employees to display.
        </Typography>
      )}
    </Box>
  );
};

// ===================== Main Component =====================
const Employees: React.FC<{ id?: number }> = ({ id }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));
  const [rows, setRows] = useState<Emp[]>([]);
  const [view, setView] = useState<"grid"|"list">("list");
  const apiBase = process.env.REACT_APP_API_IP;

  const reloadEmployees = useCallback(async () => {
    const data = await listEmployees();
    setRows(data as Emp[]);
  }, []);

  useEffect(() => {
    reloadEmployees();
  }, [reloadEmployees]);

  // (moved below state declarations)

  const openEditDialog = (row: Emp) => {
    // open your existing edit dialog code here
    console.log("edit", row);
  };

  const confirmDelete = (row: Emp) => {
    // open your delete confirmation then call your delete endpoint and reload
    console.log("delete", row);
  };

  const accent =
    (theme.palette as any)?.gaja?.[100] ?? theme.palette.primary.main;

  const [data, setData] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | "active" | "inactive">(
    "all"
  );
  const [pointsOfSale, setPointsOfSale] = useState<
    Array<{ Id_point: number; name_point: string }>
  >([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [jobForm, setJobForm] = useState<Partial<JobRow>>({
    job_name: "",
    year_job: new Date().getFullYear(),
    Job_degree: 1,
    Job_level: "",
    Job_title: "",
    Job_code: "",
    job_categories: "",
  });

  const handleSaveJob = async () => {
    try {
      const payload = {
        job_name: jobForm.job_name,
        year_job: jobForm.year_job,
        job_degree: (jobForm as any).job_degree ?? jobForm.Job_degree,
        job_level: (jobForm as any).job_level ?? jobForm.Job_level,
        job_title: (jobForm as any).job_title ?? jobForm.Job_title,
        job_code: (jobForm as any).job_code ?? jobForm.Job_code,
        job_categories: jobForm.job_categories,
      } as any;
      await api.post("/jobs/job", payload);
      showSnackbar(t("hr.jobs.created", "Job created successfully"), "success");
      if (form.ID_EMP) {
        const empPatch: any = {};
        const rawJobTitle = (jobForm as any).job_title ?? jobForm.Job_title;
        const clampedTitle = rawJobTitle ? String(rawJobTitle).slice(0, 20) : undefined;
        if (clampedTitle) empPatch.TITLE = clampedTitle;
        if (form.JOB_RELATION !== undefined && form.JOB_RELATION !== null && form.JOB_RELATION !== "") {
          const raw = form.JOB_RELATION as any;
          const mgrId = typeof raw === 'number' ? raw : Number(String(raw).match(/\d+/)?.[0] || NaN);
          if (Number.isFinite(mgrId)) empPatch.JOB_RELATION = Number(mgrId);
        }
        if (form.NAME) empPatch.NAME = form.NAME;
        if (Object.keys(empPatch).length > 0) {
          try {
            await api.patch(`/employees/${form.ID_EMP}`, empPatch);
            if (clampedTitle) {
              setForm((prev)=>({ ...prev, TITLE: clampedTitle } as any));
              setSelected((prev)=> prev ? ({ ...prev, TITLE: clampedTitle } as any) : prev);
              setData((prev)=> prev.map(e=> e.ID_EMP===form.ID_EMP ? ({ ...e, TITLE: clampedTitle } as any) : e));
            }
            showSnackbar(t('hr.org.reassigned', 'Reassigned successfully'), 'success');
          } catch (e:any) {
            const msg = e?.response?.data?.message || e?.message || 'Reassignment failed';
            // Fallback: try PUT with NAME if available (some backends require NAME on PUT)
            const displayName = (form.NAME || `${form.FIRST_NAME || ''} ${form.SURNAME || ''}`.trim());
            if (displayName) {
              try {
                await api.put(`/employees/${form.ID_EMP}`, { NAME: displayName, TITLE: clampedTitle, JOB_RELATION: empPatch.JOB_RELATION });
                if (clampedTitle) {
                  setForm((prev)=>({ ...prev, TITLE: clampedTitle } as any));
                  setSelected((prev)=> prev ? ({ ...prev, TITLE: clampedTitle } as any) : prev);
                  setData((prev)=> prev.map(e=> e.ID_EMP===form.ID_EMP ? ({ ...e, TITLE: clampedTitle } as any) : e));
                }
                showSnackbar(t('hr.org.reassigned', 'Reassigned successfully'), 'success');
              } catch (e2:any) {
                const msg2 = e2?.response?.data?.message || e2?.message || 'Reassignment failed';
                showSnackbar(`${t('hr.org.reassignFailed','Reassignment failed')}: ${msg2}`, 'error');
              }
            } else {
              showSnackbar(`${t('hr.org.reassignFailed','Reassignment failed')}: ${msg}`, 'error');
            }
          }
        }
        await fetchEmployees();
      }

      await fetchJobs();
      setJobDialogOpen(false);
      setJobForm({
        job_name: "",
        year_job: new Date().getFullYear(),
        Job_degree: 1,
        Job_level: "",
        Job_title: "",
        Job_code: "",
        job_categories: "",
      });
    } catch (err: any) {
      showSnackbar(
        t("hr.toast.saveError", {
          defaultValue: "Error saving job: {{msg}}",
          msg: err.response?.data?.message || err.message,
        }),
        "error"
      );
    }
  };

  const [tab, setTab] = useState(0); // 0 Directory, 1 Profile, 2 Org, 3 Roles
  const [selected, setSelected] = useState<Employee | null>(null);
  const [selectedEmp, setSelectedEmp] = React.useState<MinimalEmployee | null>(
    null
  );
  const [employees, setEmployees] = React.useState<MinimalEmployee[]>([]);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [open, setOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<Employee>(emptyEmployee);
  const [step, setStep] = useState(0);
  const [errorsState, setErrors] = useState<Record<string, string>>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [salaryInUSD, setSalaryInUSD] = useState<boolean>(false);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const dedupedSource = useMemo(
    () => dedupeEmployees((allEmployees.length ? allEmployees : data) ?? []),
    [allEmployees, data]
  );

   const orgEmployees = useMemo(() => {
    const active = dedupedSource.filter((employee) => isActiveEmployee(employee));
    const unique = new Map<string, Employee>();
    active.forEach((emp) => {
      const key = employeeKey(emp);
      if (!unique.has(key)) unique.set(key, emp);
    });
    return Array.from(unique.values());
  }, [dedupedSource]);
  
  const inactiveDisplay = useMemo(() => {
    const activeKeys = new Set(orgEmployees.map((emp) => employeeKey(emp)));
    return dedupedSource.filter((employee) => !activeKeys.has(employeeKey(employee)));
  }, [dedupedSource, orgEmployees]);

  const orgActiveCount = orgEmployees.length;
  const orgTotalCount = dedupedSource.length;

  const inactiveEmployees = useMemo(() => {
    if (!dedupedSource.length) return [];
    const activeKeys = new Set(orgEmployees.map((emp) => employeeKey(emp)));
    return dedupedSource.filter((employee) => !activeKeys.has(employeeKey(employee)));
  }, [dedupedSource, orgEmployees]);
  const [psFilter, setPsFilter] = useState("");
  const [sortField, setSortField] = useState<"name" | "id" | "ps">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [schedOpen, setSchedOpen] = useState(false);
  const [schedEmpId, setSchedEmpId] = useState<number | null>(null);
  const [schedEmpName, setSchedEmpName] = useState<string>("");
  const [schedStart, setSchedStart] = useState<string>("");
  const [schedEnd, setSchedEnd] = useState<string>("");
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedError, setSchedError] = useState<string | null>(null);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());

  // Attendance profiles (group multiple employees)
  type AttendanceProfile = { name: string; days: string[]; start: string; end: string };
  const [attendanceProfiles, setAttendanceProfiles] = useState<AttendanceProfile[]>(() => {
    try {
      const raw = localStorage.getItem('attendanceProfiles');
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  });
  useEffect(()=>{
    try { localStorage.setItem('attendanceProfiles', JSON.stringify(attendanceProfiles)); } catch {}
  },[attendanceProfiles]);
  const [attUseProfile, setAttUseProfile] = useState<boolean>(true);
  const [attProfileName, setAttProfileName] = useState<string>("");
  const [attDays, setAttDays] = useState<Set<string>>(new Set(["Mon","Tue","Wed","Thu","Fri"]));
  const [attStart, setAttStart] = useState<string>("09:00");
  const [attEnd, setAttEnd] = useState<string>("17:00");
  const toggleDay = (d: string) => setAttDays((s)=>{ const n=new Set(s); if(n.has(d)) n.delete(d); else n.add(d); return n; });
  const [attMgrOpen, setAttMgrOpen] = useState<boolean>(false);
  const [attMgrDraft, setAttMgrDraft] = useState<AttendanceProfile>({ name: "", days: ["Mon","Tue","Wed","Thu","Fri"], start: "09:00", end: "17:00" });

  // Seller user mapping (for Seller Reports linkage)
  const [sellerUsers, setSellerUsers] = useState<Array<{ id_user: number; name_user: string }>>([]);
  const [sellerUserId, setSellerUserId] = useState<number | null>(null);
  // Commission role (Sales Rep / Senior / Lead / Manager)
  const [commissionRole, setCommissionRole] = useState<string>("");
  const [posOptions, setPosOptions] = useState<Array<{ Id_point: number; name_point: string }>>([]);
  const [commissionPs, setCommissionPs] = useState<number[]>([]);
  const fetchSellerUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await api.get(`/users/ListUsers`, { headers: { Authorization: token ? `Bearer ${token}` : undefined } });
      const arr = Array.isArray(res.data) ? res.data : [];
      setSellerUsers(arr);
    } catch {}
  }, []);
  useEffect(()=>{ fetchSellerUsers(); }, [fetchSellerUsers]);

  // Fetch POS list for branch/PS scopes
  const fetchPos = useCallback(async () => {
    try {
      const apiIp = process.env.REACT_APP_API_IP || "";
      const token = localStorage.getItem('token') || '';
      const res = await api.get(`${apiIp}/ps/all`, { headers: { Authorization: token ? `Bearer ${token}` : undefined } });
      const arr = Array.isArray(res.data) ? res.data : [];
      setPosOptions(arr);
    } catch {}
  }, []);
  useEffect(()=>{ fetchPos(); }, [fetchPos]);

  const openSchedFor = useCallback(
    (id: number, name: string, start?: string | null, end?: string | null) => {
      setSchedEmpId(id);
      setSchedEmpName(name);
      setSchedStart((start ?? "").slice(0, 5));
      setSchedEnd((end ?? "").slice(0, 5));
      setSchedError(null);
      setSchedOpen(true);
    },
    []
  );

  const closeSched = () => setSchedOpen(false);

  const saveSched = async () => {
    if (!schedEmpId) return;
    try {
      setSchedSaving(true);
      setSchedError(null);
      await updateEmployeeTimes(schedEmpId, {
        T_START: schedStart || null,
        T_END: schedEnd || null,
      });
      // optimistic UI: update local list if you have it
      setEmployees((prev) =>
        prev.map((e) =>
          e.ID_EMP === schedEmpId
            ? ({ ...e, T_START: schedStart, T_END: schedEnd } as any)
            : e
        )
      );
      setSchedOpen(false);
    } catch (err: any) {
      setSchedError(err?.message || "Failed to save schedule");
    } finally {
      setSchedSaving(false);
    }
  };

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
  }>({ open: false, message: "", severity: "info" });

  React.useEffect(() => {
    listEmployees().then(setEmployees).catch(console.error);
  }, []);

  const handleOpenProfile = (emp: MinimalEmployee) => {
    setSelectedEmp(emp);
    setProfileOpen(true);
  };

  const showSnackbar = (
    message: string,
    severity: "success" | "error" | "info" = "info"
  ) => setSnackbar({ open: true, message, severity });

  const posNameById = useMemo(() => {
    const m = new Map<number, string>();
    pointsOfSale.forEach((p) => m.set(p.Id_point, p.name_point));
    return m;
  }, [pointsOfSale]);

  const levelByTitle = useMemo(() => {
    const m = new Map<string, string>();
    jobs.forEach((j) => {
      if (j.Job_title) m.set(j.Job_title, j.Job_level);
    });
    return m;
  }, [jobs]);

  const departments = useMemo(() => {
    const s = new Set<string>();
    jobs.forEach((j) => {
      if (j.job_categories) s.add(j.job_categories);
    });
    return Array.from(s).sort();
  }, [jobs]);

  const coworkers = useMemo<Employee[]>(() => {
    if (!selected) return [];
    const title = selected.TITLE || "";
    const lvl = title ? levelByTitle.get(title) : undefined;
    if (!title || !lvl) return [];
    return data.filter(
      (e) =>
        e.ID_EMP !== selected.ID_EMP &&
        e.TITLE === title &&
        levelByTitle.get(e.TITLE || "") === lvl
    );
  }, [selected, data, levelByTitle]);

  const reassignEmployee = async (empId: number, newMgrId: number | null) => {
    const prev = data.map((e) => ({ ...e }));
    const updated = data.map((e) =>
      Number(e.ID_EMP) === Number(empId)
        ? { ...e, JOB_RELATION: newMgrId as any }
        : e
    );
    setData(updated);
    try {
      await api.put(`/employees/${empId}`, { JOB_RELATION: newMgrId });
      showSnackbar(
        t("hr.org.reassigned", "Reassigned successfully"),
        "success"
      );
    } catch {
      setData(prev);
      showSnackbar(t("hr.org.reassignFailed", "Reassignment failed"), "error");
    }
  };

  type UnavailabilitySlot = { start: string; end: string; note?: string };
  const [employedElsewhere, setEmployedElsewhere] = useState<boolean>(false);
  const [unavailable, setUnavailable] = useState<UnavailabilitySlot[]>([]);

  const fetchPointsOfSale = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await api.get(`${BASE_URL}/ps/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPointsOfSale(response.data);
    } catch (error) {
      console.error("Error fetching points of sale:", error);
      showSnackbar(
        t("hr.toast.fetchPOSFailed", "Failed to fetch points of sale"),
        "error"
      );
    }
  }, [t]);

  useEffect(() => {
    fetchPointsOfSale();
  }, [fetchPointsOfSale]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (form.PS) params.PS = String(form.PS);
      const res = await api.get("/employees", {
        params,
        paramsSerializer: { indexes: null },
      });
      const employeesData = Array.isArray(res.data)
        ? res.data
        : res.data.data || [];
      setData(employeesData);
    } catch (err: any) {
      console.error("Employees fetch failed:", err);
      setError(
        err.response?.data?.message ||
          t("hr.toast.fetchFailed", "Failed to fetch employees")
      );
    } finally {
      setLoading(false);
    }
  }, [search, stateFilter, form.PS, t]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const fetchAllEmployees = useCallback(async () => {
    try {
      const res = await api.get("/employees");
      const employeesData = Array.isArray(res.data)
        ? res.data
        : res.data.data || [];
      setAllEmployees(employeesData);

      try {
        const activeList = await listActiveEmployees();
        if (Array.isArray(activeList)) {
          setActiveEmployees(activeList as Employee[]);
        } else {
          setActiveEmployees([]);
        }
      } catch (activeErr) {
        console.warn("Active employees fetch failed, falling back to heuristic:", activeErr);
        setActiveEmployees(
          employeesData.filter((emp: Employee) => isActiveEmployee(emp))
        );
      }
    } catch (err) {
      console.error("All employees fetch failed:", err);
    }
  }, []);
  useEffect(() => {
    fetchAllEmployees();
  }, [fetchAllEmployees]);

  // Deep-link: if id is provided, auto-select that employee and jump to Profile tab
  useEffect(() => {
    if (!id) return;
    const numId = Number(id);
    if (!Number.isFinite(numId) || numId <= 0) return;
    const fromData = data.find((e) => Number(e.ID_EMP) === numId);
    const fromAll = allEmployees.find((e) => Number(e.ID_EMP) === numId);
    const merged = fromData || fromAll || null;
    if (merged) {
      setSelected(merged);
      setTab(1);
    }
  }, [id, data, allEmployees]);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await api.get("/jobs/jobs");
      const arr = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setJobs(arr);
    } catch (e) {
      console.error("Error fetching jobs", e);
    }
  }, []);
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const resetDialog = () => {
    setOpen(false);
    setIsEdit(false);
    setForm(emptyEmployee);
    setErrors({});
    setStep(0);
    setPhotoPreview(null);
  };

  const openAdd = () => {
    setForm(emptyEmployee);
    setIsEdit(false);
    setOpen(true);
    setStep(0);
    setSalaryInUSD(false);
    setEmployedElsewhere(false);
    setUnavailable([]);
    setSellerUserId(null);
    setCommissionRole("");
    setCommissionPs([]);
  };

  const openEdit = (row: Employee) => {
    setForm({ ...row });
    setIsEdit(true);
    setOpen(true);
    setStep(0);
    setPhotoPreview(row.PICTURE_URL || null);

    // seed salary toggle
    setSalaryInUSD(!!row.BASIC_SALARY_USD && Number(row.BASIC_SALARY_USD) > 0);

    // try to read embedded JSON from JOB_DESCRIPTION if exists
    try {
      if (
        row.JOB_DESCRIPTION &&
        String(row.JOB_DESCRIPTION).includes("__availability__")
      ) {
        const parsed = JSON.parse(row.JOB_DESCRIPTION);
        setEmployedElsewhere(!!parsed?.__availability__?.employedElsewhere);
        setUnavailable(
          Array.isArray(parsed?.__availability__?.slots)
            ? parsed.__availability__.slots
            : []
        );
        // attendance config
        if (parsed?.__attendance__) {
          const a = parsed.__attendance__;
          setAttUseProfile(a?.mode === 'profile');
          setAttProfileName(a?.profile || "");
          const ds = Array.isArray(a?.days) ? a.days : [];
          setAttDays(new Set(ds as string[]));
          if (a?.start) setAttStart(String(a.start).slice(0,5));
          if (a?.end) setAttEnd(String(a.end).slice(0,5));
        }
        // seller mapping
        if (parsed?.__sales__ && (parsed.__sales__.userId != null)) {
          const sid = Number(parsed.__sales__.userId);
          setSellerUserId(Number.isFinite(sid) ? sid : null);
        } else {
          setSellerUserId(null);
        }
        // commission role
        if (parsed?.__commissions__ && parsed.__commissions__.role) {
          setCommissionRole(String(parsed.__commissions__.role));
          const ps = parsed.__commissions__.ps;
          setCommissionPs(Array.isArray(ps) ? ps.map((x:any)=> Number(x)).filter((n:number)=> Number.isFinite(n)) : []);
        } else {
          setCommissionRole("");
          setCommissionPs([]);
        }
      } else {
        setEmployedElsewhere(false);
        setUnavailable([]);
        setAttUseProfile(true);
        setAttProfileName("");
        setAttDays(new Set(["Mon","Tue","Wed","Thu","Fri"]));
        setAttStart("09:00");
        setAttEnd("17:00");
        setSellerUserId(null);
        setCommissionRole("");
        setCommissionPs([]);
      }
    } catch {
      setEmployedElsewhere(false);
      setUnavailable([]);
      setAttUseProfile(true);
      setAttProfileName("");
      setAttDays(new Set(["Mon","Tue","Wed","Thu","Fri"]));
      setAttStart("09:00");
      setAttEnd("17:00");
      setSellerUserId(null);
      setCommissionRole("");
      setCommissionPs([]);
    }
  };

  const sanitizeEmployeePayload = (src: Employee) => {
    const out: any = { ...src };
    Object.keys(out).forEach((k) => {
      const v = (out as any)[k];
      if (typeof v === "string") {
        const trimmed = v.trim();
        (out as any)[k] = trimmed === "" ? null : trimmed;
      }
    });
    const numberFields = [
      "BANK",
      "NUM_OF_CHILDREN",
      "ANNUAL_LEAVE_BAL",
      "FOOD",
      "FUEL",
      "COMMUNICATION",
      "DIAMOND_COMM",
      "FOOD_ALLOWANCE",
      "GOLD_COMM_VALUE",
      "BASIC_SALARY",
      "PS",
    ];
    numberFields.forEach((f) => {
      const v = (out as any)[f];
      if (v === "" || v === undefined) (out as any)[f] = null;
      else if (v !== null) (out as any)[f] = Number(v);
    });
    out.STATE = typeof out.STATE === "boolean" ? out.STATE : true;

    if (out.NATIONALITY) {
      const nat = String(out.NATIONALITY).toLowerCase();
      out.IS_FOREINGHT = nat !== "libyan";
    } else {
      out.IS_FOREINGHT = !!out.IS_FOREINGHT;
    }
    out.FINGERPRINT_NEEDED = !!out.FINGERPRINT_NEEDED;

    if (out.PS !== undefined && out.PS !== null && out.PS !== "")
      out.PS = Number(out.PS);

    if (
      (!out.NAME || String(out.NAME).trim() === "") &&
      (out.FIRST_NAME || out.SURNAME)
    ) {
      const parts = [out.FIRST_NAME, out.SURNAME]
        .filter(Boolean)
        .join(" ")
        .trim();
      out.NAME = parts || null;
    }

    if (
      !out.PICTURE_URL ||
      (typeof out.PICTURE_URL === "string" && out.PICTURE_URL.trim() === "")
    ) {
      out.PICTURE_URL = null;
    }
    if (
      !out.EDUCATION_CERT_URL ||
      (typeof out.EDUCATION_CERT_URL === "string" &&
        out.EDUCATION_CERT_URL.trim() === "")
    ) {
      out.EDUCATION_CERT_URL = null;
    }
    if ("PICTURE" in out) delete out.PICTURE;

    const normalizeTime = (v: any) => {
      if (v == null || v === "") return null;
      const s = String(v).trim();
      if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
      if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
      return null;
    };
    if ("T_START" in out) out.T_START = normalizeTime(out.T_START);
    if ("T_END" in out) out.T_END = normalizeTime(out.T_END);
    return out;
  };

  const uploadEmployeePhoto = async (id: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    await api.post(`/employees/${id}/picture`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const removeEmployeePhoto = async (id: number) => {
    await api.delete(`/employees/${id}/picture`);
  };

  const validate = (currentStep = step, mode: "step" | "all" = "step") => {
    const e: Record<string, string> = {};

    if (currentStep === 0 || mode === "all") {
      if (!form.NAME || String(form.NAME).trim() === "")
        e.NAME = t("employees.errors.nameRequired", "Name is required");
      if (form.EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.EMAIL))
        e.EMAIL = t("hr.errors.email", "Invalid email");
    }

    if (currentStep === 1 || mode === "all") {
      if (form.BASIC_SALARY !== undefined && form.BASIC_SALARY !== null) {
        if (Number.isNaN(Number(form.BASIC_SALARY)))
          e.BASIC_SALARY = t(
            "hr.errors.salaryNumber",
            "Salary must be a number"
          );
      }
      if (mode === "all") {
        if (!form.CONTRACT_START || String(form.CONTRACT_START).trim() === "") {
          e.CONTRACT_START = t(
            "employees.errors.contractStartRequired",
            "Contract start date is required"
          );
        }
        if (form.CONTRACT_START && form.CONTRACT_END) {
          const cs = new Date(String(form.CONTRACT_START));
          const ce = new Date(String(form.CONTRACT_END));
          if (!isNaN(cs.getTime()) && !isNaN(ce.getTime()) && ce < cs) {
            e.CONTRACT_END = t(
              "employees.errors.contractOrder",
              "Contract end must be after start"
            );
          }
        }
      }
    }

    if (currentStep === 2 || mode === "all") {
      if (
        form.NUM_OF_CHILDREN !== undefined &&
        form.NUM_OF_CHILDREN !== null &&
        Number.isNaN(Number(form.NUM_OF_CHILDREN))
      ) {
        e.NUM_OF_CHILDREN = t("hr.errors.mustBeNumber", "Must be a number");
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const DIALOG_PAPER_SX = {
    width: { xs: "100%", sm: "96vw", md: "92vw", lg: "86vw" },
    maxWidth: "none" as const,
    height: { xs: "100vh", sm: "94vh" },
    m: { xs: 0, sm: 1.5 },
    display: "flex",
    flexDirection: "column",
    borderRadius: 3,
    "& .MuiDialogContent-root": {
      flex: 1,
      overflowY: "auto",
      px: { xs: 2, sm: 4, md: 6 },
      py: { xs: 2, sm: 3 },
    },
    "& .MuiDialogActions-root": {
      px: { xs: 2, sm: 4, md: 6 },
      py: { xs: 2, md: 3 },
      borderTop: (theme: any) => `1px solid ${theme.palette.divider}`,
      backgroundColor: "background.paper",
    },
  };

  const handleEdit = (emp: MinimalEmployee) => {
    const id = Number(emp.ID_EMP);
    const fromData = Number.isFinite(id)
      ? data.find((row) => Number(row.ID_EMP) === id) ||
        allEmployees.find((row) => Number(row.ID_EMP) === id)
      : null;

    const merged: Employee | null = (fromData
      ? { ...emptyEmployee, ...fromData }
      : emp
        ? ({ ...emptyEmployee, ...emp } as Employee)
        : null);

    if (!merged) {
      showSnackbar(
        t(
          "hr.toast.loadEmployeeFailed",
          "Unable to load employee details for editing"
        ),
        "error"
      );
      return;
    }

    setSelectedEmp(merged);
    openEdit(merged);
  };

  const handleCloseProfile = () => {
    setSelectedEmp(null);
    setProfileOpen(false);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const employeeData = sanitizeEmployeePayload(form);

      // salary toggle rules
      if (salaryInUSD) {
        // LYD optional
        if (
          !employeeData.BASIC_SALARY_USD ||
          Number.isNaN(Number(employeeData.BASIC_SALARY_USD))
        ) {
          setLoading(false);
          return showSnackbar(
            t(
              "hr.errors.salaryUsdRequired",
              "USD salary is required when 'Salary in USD' is selected"
            ),
            "error"
          );
        }
        // keep LYD if user entered; otherwise null
        if (employeeData.BASIC_SALARY === "") employeeData.BASIC_SALARY = null;
      }

      // embed education/employment availability into JOB_DESCRIPTION as JSON (non-breaking)
      const availability = {
        __availability__: {
          employedElsewhere,
          slots: unavailable.filter((s) => s.start && s.end),
        },
        __attendance__: {
          mode: attUseProfile ? 'profile' : 'custom',
          profile: attUseProfile ? attProfileName : null,
          days: Array.from(attDays),
          start: attStart ? `${attStart}:00` : null,
          end: attEnd ? `${attEnd}:00` : null,
        },
        __sales__: {
          userId: sellerUserId,
        },
        __commissions__: {
          role: commissionRole || null,
          ps: commissionPs,
        },
        __note__: "Temporary FE embed until BE fields exist",
      };

      // if JOB_DESCRIPTION already carries structured JSON, merge it; else replace
      try {
        const existing = employeeData.JOB_DESCRIPTION
          ? JSON.parse(employeeData.JOB_DESCRIPTION)
          : {};
        employeeData.JOB_DESCRIPTION = JSON.stringify({
          ...existing,
          ...availability,
        });
      } catch {
        employeeData.JOB_DESCRIPTION = JSON.stringify(availability);
      }

      if (isEdit && form.ID_EMP) {
        await api.put(`/employees/${form.ID_EMP}`, employeeData);
        setSnackbar({
          open: true,
          message: t("hr.toast.updated", "Employee updated successfully"),
          severity: "success",
        });
      } else {
        await api.post("/employees", employeeData);
        setSnackbar({
          open: true,
          message: t("hr.toast.created", "Employee created successfully"),
          severity: "success",
        });
      }
      fetchEmployees();
      resetDialog();
    } catch (err: any) {
      console.error("Error saving employee:", err);
      setSnackbar({
        open: true,
        message: t("hr.toast.saveError", {
          defaultValue: "Error saving employee: {{msg}}",
          msg: err.response?.data?.message || err.message,
        }),
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  function dataURLToFile(dataUrl: string, filename: string) {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  }

  const handleSubmit = async () => {
    const ok = validate(0, "all");
    if (!ok) {
      showSnackbar(t("hr.toast.fixErrors", "Please fix the errors"), "error");
      return;
    }
    await handleSave();
  };

  const handleNextStep = () => {
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handlePreviousStep = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleDelete = async (row: Employee) => {
    if (!row.ID_EMP) return;
    if (
      !window.confirm(
        t("hr.confirm.delete", {
          defaultValue: 'Delete employee "{{name}}"?',
          name: row.NAME,
        })
      )
    )
      return;
    try {
      await api.delete(`/employees/${row.ID_EMP}`);
      showSnackbar(
        t("hr.toast.deleted", "Employee deleted successfully!"),
        "success"
      );
      await fetchEmployees();
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        t("hr.toast.deleteFailed", "Delete failed");
      showSnackbar(errorMessage, "error");
    }
  };

  const handleExportExcel = () => {
    if (data.length === 0) {
      showSnackbar(t("hr.toast.noData", "No data to export"), "info");
      return;
    }
    const headers = [
      t("employees.fields.ID_EMP", "ID"),
      t("employees.fields.NAME", "Name"),
      t("employees.fields.TITLE", "Title"),
      t("employees.fields.EMAIL", "Email"),
      t("employees.fields.PHONE", "Phone"),
      t("employees.fields.PS", "Cost Center"),
      t("employees.fields.STATE", "Active"),
      t("employees.fields.BASIC_SALARY", "Salary"),
      t("employees.fields.CONTRACT_START", "Contract Start"),
      t("employees.fields.CONTRACT_END", "Contract End"),
    ];
    const rows = data.map((e) => [
      e.ID_EMP,
      e.NAME,
      e.TITLE || "",
      e.EMAIL || "",
      e.PHONE || "",
      e.PS || "",
      e.STATE ? t("common.yes", "Yes") : t("common.no", "No"),
      e.BASIC_SALARY ?? "",
      e.CONTRACT_START || "",
      e.CONTRACT_END || "",
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "employees");
    XLSX.writeFile(workbook, "employees.xlsx");
    showSnackbar(t("hr.toast.exportDone", "Export completed!"), "success");
  };

  // === View toggle buttons ===
  const ViewToggle = () => (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2, p: 1 }}>
      <ButtonGroup size="small">
        <Button
          variant={viewMode === 'grid' ? 'contained' : 'outlined'}
          onClick={() => setViewMode('grid')}
          startIcon={<GridViewIcon />}
        >
          Grid
        </Button>
        <Button
          variant={viewMode === 'list' ? 'contained' : 'outlined'}
          onClick={() => setViewMode('list')}
          startIcon={<ViewListIcon />}
        >
          List
        </Button>
      </ButtonGroup>
    </Box>
  );

  // === Directory views ===
  const DirectoryGrid = () => (
    <Box sx={{ p: 1, width: "100%" }}>
      <ViewToggle />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
          gap: 2,
          mt: 2,
          width: "100%",
        }}
      >
        {filteredEmployees.map((employee) => (
          <Box
            key={employeeKey(employee)}
            onClick={() => {
              setSelected(employee);
              setTab(1);
            }}
          >
            <EmployeeCard
              employee={employee}
              apiBase={apiBase}
              onOpenProfile={handleOpenProfile}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onUpdateTimes={async (id, t) => updateEmployeeTimes(id, t)}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
  
  // === List View Component ===
  const DirectoryList = () => (
    <Box sx={{ p: 1, width: "100%" }}>
      <ViewToggle />
      <Box sx={{ mt: 2, width: "100%" }}>
        <EmployeeList
          rows={filteredEmployees}
          apiBase={apiBase}
          dense={false}
          onOpenProfile={(employee) => {
            setSelected(employee);
            setTab(1);
          }}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onUpdateTimes={async (id, t) => updateEmployeeTimes(id, t)}
        />
      </Box>
    </Box>
  );

  // Initialize filteredEmployees with proper TypeScript types
  const filteredEmployees = useMemo(() => {
    let result = [...data];

    // Apply search filter
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (employee) =>
          employee.NAME?.toLowerCase().includes(q) ||
          employee.EMAIL?.toLowerCase().includes(q) ||
          employee.PHONE?.includes(q) ||
          employee.TITLE?.toLowerCase().includes(q) ||
          String(employee.ID_EMP || "").includes(q)
      );
    }

    // Apply state filter
    if (stateFilter !== "all") {
      result = result.filter((employee) =>
        stateFilter === "active" ? isActiveEmployee(employee) : !isActiveEmployee(employee)
      );
    }

    // Apply PS filter
    if (psFilter) {
      result = result.filter(
        (employee) => String(employee.PS || "") === psFilter
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;

      const aActive = isActiveEmployee(a);
      const bActive = isActiveEmployee(b);
      if (stateFilter === "all" && aActive !== bActive) {
        // Active employees always appear before inactive when viewing all
        return aActive ? -1 : 1;
      }

      switch (sortField) {
        case "name":
          comparison = (a.NAME || "").localeCompare(b.NAME || "");
          break;
        case "id":
          comparison = (a.ID_EMP || 0) - (b.ID_EMP || 0);
          break;
        case "ps":
          const psA = String(a.PS || "");
          const psB = String(b.PS || "");
          comparison = psA.localeCompare(psB);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [data, search, stateFilter, psFilter, sortField, sortDirection]);

  const setField = (k: keyof Employee, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Persist title immediately when position changes in Profile
  const handleChangeTitle = async (nextTitle: string) => {
    setForm((prev) => ({ ...prev, TITLE: nextTitle } as any));
    setSelected((prev) => (prev ? ({ ...prev, TITLE: nextTitle } as any) : prev));
    if (form.ID_EMP) {
      try {
        await api.patch(`/employees/${form.ID_EMP}`, { TITLE: nextTitle });
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || 'Failed to save position';
        showSnackbar(msg, 'error');
      }
    }
  };

  const [activeSaving, setActiveSaving] = useState(false);
  const handleToggleActive = useCallback(
    async (nextActive: boolean) => {
      if (!selected?.ID_EMP) return;
      const empId = Number(selected.ID_EMP);
      if (!Number.isFinite(empId) || empId <= 0) return;

      const prevSelected = selected;

      setSelected((prev) => (prev ? ({ ...prev, STATE: nextActive } as any) : prev));
      setData((prev) =>
        prev.map((e) =>
          Number(e.ID_EMP) === empId ? ({ ...e, STATE: nextActive } as any) : e
        )
      );
      setAllEmployees((prev) =>
        prev.map((e) =>
          Number(e.ID_EMP) === empId ? ({ ...e, STATE: nextActive } as any) : e
        )
      );

      try {
        setActiveSaving(true);
        try {
          await api.patch(`/employees/${empId}`, { STATE: nextActive });
        } catch (e: any) {
          const payload: any = { STATE: nextActive };
          if (prevSelected?.NAME) payload.NAME = prevSelected.NAME;
          await api.put(`/employees/${empId}`, payload);
        }
        showSnackbar(
          nextActive
            ? t("hr.toast.activated", "Employee activated")
            : t("hr.toast.deactivated", "Employee deactivated"),
          "success"
        );
        await fetchEmployees();
        await fetchAllEmployees();
      } catch (e: any) {
        setSelected(prevSelected);
        setData((prev) =>
          prev.map((emp) =>
            Number(emp.ID_EMP) === empId ? ({ ...emp, STATE: prevSelected.STATE } as any) : emp
          )
        );
        setAllEmployees((prev) =>
          prev.map((emp) =>
            Number(emp.ID_EMP) === empId ? ({ ...emp, STATE: prevSelected.STATE } as any) : emp
          )
        );
        const msg = e?.response?.data?.message || e?.message || "Failed to update status";
        showSnackbar(msg, "error");
      } finally {
        setActiveSaving(false);
      }
    },
    [selected, t, fetchEmployees, fetchAllEmployees]
  );

  const [fingerprintSaving, setFingerprintSaving] = useState(false);
  const handleToggleFingerprint = useCallback(
    async (nextRequired: boolean) => {
      if (!selected?.ID_EMP) return;
      const empId = Number(selected.ID_EMP);
      if (!Number.isFinite(empId) || empId <= 0) return;

      const prevSelected = selected;

      setSelected((prev) =>
        prev ? ({ ...prev, FINGERPRINT_NEEDED: nextRequired } as any) : prev
      );
      setData((prev) =>
        prev.map((e) =>
          Number(e.ID_EMP) === empId
            ? ({ ...e, FINGERPRINT_NEEDED: nextRequired } as any)
            : e
        )
      );
      setAllEmployees((prev) =>
        prev.map((e) =>
          Number(e.ID_EMP) === empId
            ? ({ ...e, FINGERPRINT_NEEDED: nextRequired } as any)
            : e
        )
      );

      try {
        setFingerprintSaving(true);
        try {
          await api.patch(`/employees/${empId}`, {
            FINGERPRINT_NEEDED: nextRequired,
          });
        } catch (e: any) {
          const payload: any = { FINGERPRINT_NEEDED: nextRequired };
          if (prevSelected?.NAME) payload.NAME = prevSelected.NAME;
          await api.put(`/employees/${empId}`, payload);
        }
        showSnackbar(
          nextRequired
            ? t("hr.toast.fingerprintEnabled", "Fingerprint required enabled")
            : t("hr.toast.fingerprintDisabled", "Fingerprint required disabled"),
          "success"
        );
        await fetchEmployees();
        await fetchAllEmployees();
      } catch (e: any) {
        setSelected(prevSelected);
        setData((prev) =>
          prev.map((emp) =>
            Number(emp.ID_EMP) === empId
              ? ({ ...emp, FINGERPRINT_NEEDED: prevSelected.FINGERPRINT_NEEDED } as any)
              : emp
          )
        );
        setAllEmployees((prev) =>
          prev.map((emp) =>
            Number(emp.ID_EMP) === empId
              ? ({ ...emp, FINGERPRINT_NEEDED: prevSelected.FINGERPRINT_NEEDED } as any)
              : emp
          )
        );
        const msg = e?.response?.data?.message || e?.message || "Failed to update fingerprint setting";
        showSnackbar(msg, "error");
      } finally {
        setFingerprintSaving(false);
      }
    },
    [selected, t, fetchEmployees, fetchAllEmployees]
  );

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const onPhotoChange = async (f: File | null) => {
    setPhotoPreview(f ? URL.createObjectURL(f) : null);
    try {
      if (!f) {
        if (form.ID_EMP) await removeEmployeePhoto(form.ID_EMP);
        setField("PICTURE_URL", "");
      } else if (form.ID_EMP) {
        await uploadEmployeePhoto(form.ID_EMP, f);
      } else {
        const dataUrl = await fileToDataUrl(f);
        setField("PICTURE_URL", dataUrl);
      }
      if (form.ID_EMP) await fetchEmployees();
    } catch (e: any) {
      console.error("Photo update failed", e);
      showSnackbar(
        t("hr.toast.saveError", {
          defaultValue: "Error saving employee: {{msg}}",
          msg: e?.response?.data?.message || e?.message,
        }),
        "error"
      );
    }
  };

  const EmptyState = () => (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 3, sm: 6 },
        textAlign: "center",
        bgcolor: "background.paper",
        border: "2px dashed",
        borderColor: "divider",
        m: 1,
      }}
    >
      <PersonAddIcon
        sx={{
          fontSize: { xs: 48, sm: 64 },
          color: "action.disabled",
          mb: 2,
        }}
      />
      <Typography variant="h6" color="text.secondary" gutterBottom>
        {t("hr.empty.title", "No employees found")}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 3, maxWidth: "400px", mx: "auto" }}
      >
        {t(
          "hr.empty.subtitle",
          "Try adjusting your search filters or add a new employee."
        )}
      </Typography>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={openAdd}
        sx={{ borderRadius: 3, px: 3, py: 1 }}
      >
        {t("hr.actions.addFirst", "Add First Employee")}
      </Button>
    </Paper>
  );

  // Compact row renderer
  const Row: React.FC<{
    icon: React.ReactNode;
    label: string;
    value?: string | null;
  }> = ({ icon, label, value }) => (
    <Stack direction="row" spacing={2} alignItems="center">
      <Box sx={{ color: accent, display: "flex", alignItems: "center" }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontWeight: 600,
            display: "block",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            fontWeight: 600,
            color: "text.primary",
          }}
        >
          {value || t("common.notSpecified", "—")}
        </Typography>
      </Box>
    </Stack>
  );

  const AllDetails: React.FC<{ record: Employee }> = ({ record }) => {
    const entries = Object.entries(record)
      .filter(([k]) => k !== "PICTURE")
      .sort(([a], [b]) => a.localeCompare(b));

    const formatValue = (k: string, v: any): React.ReactNode => {
      if (v === null || v === undefined || v === "")
        return t("common.notSpecified", "—");
      if (typeof v === "boolean") return <BoolChip value={v} />;
      if (typeof v === "number") {
        if (/_SALARY|_ALLOWANCE|_VALUE|^FOOD$|^FUEL$|^COMMUNICATION$/i.test(k))
          return currency(v);
        return new Intl.NumberFormat().format(v);
      }
      if (typeof v === "string") {
        if (isDateKey(k) && !isNaN(Date.parse(v))) return fmtDate(v);
        return v;
      }
      return JSON.stringify(v);
    };

    const groups: { title: string; keys: string[] }[] = [
      {
        title: t("employees.sections.personal", "Personal Information"),
        keys: [
          "NAME",
          "FIRST_NAME",
          "SURNAME",
          "NAME_ENGLISH",
          "EMAIL",
          "PHONE",
          "GENDER",
          "DATE_OF_BIRTH",
          "PLACE_OF_BIRTH",
          "NATIONALITY",
          "MARITAL_STATUS",
          "NUM_OF_CHILDREN",
          "BLOOD_TYPE",
          "MOTHER_NAME_AR",
          "EMERGENCY_CONTACT_RELATION",
          "EMERGENCY_CONTACT_PHONE",
          "ADDRESS",
          "COMMENT",
          "MEDICAL_COMMENT",
        ],
      },
      {
        title: t("employees.sections.work", "Work & Contract"),
        keys: [
          "PS",
          "COST_CENTER",
          "TITLE",
          "JOB_RELATION",
          "CONTRACT_START",
          "CONTRACT_END",
          "ACCOMMODATION_PROVIDED",
          "STATE",
          "FINGERPRINT_NEEDED",
          "IS_FOREINGHT",
        ],
      },
      {
        title: t("employees.sections.compensation", "Compensation"),
        keys: [
          "BASIC_SALARY",
          "FOOD_ALLOWANCE",
          "FOOD",
          "FUEL",
          "COMMUNICATION",
          "GOLD_COMM",
          "GOLD_COMM_VALUE",
          "DIAMOND_COMM_TYPE",
          "DIAMOND_COMM",
          "BANK",
          "ACCOUNT_NUMBER",
          "FINANCE_NUM",
        ],
      },
      {
        title: t("employees.sections.ids", "IDs & Documents"),
        keys: [
          "NUM_CIN",
          "NUM_NATIONAL",
          "ISSUING_AUTH",
          "PASSPORT_NUM",
          "PASSPORT_ISSUING_AUTH",
          "DRIVER_LIC_NUM",
          "SCIENTIFIC_CERT",
          "EDUCATION_CERT_URL",
          "PICTURE_URL",
        ],
      },
    ];

    const groupedKeys = new Set(groups.flatMap((g) => g.keys));
    const otherEntries = entries.filter(([k]) => !groupedKeys.has(k));

    return (
      <Stack spacing={3} sx={{ width: "100%" }}>
        {groups.map((g) => {
          const sectionItems = entries.filter(([k]) => g.keys.includes(k));
          if (sectionItems.length === 0) return null;
          return (
            <Box key={g.title}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, color: "text.primary", mb: 1 }}
              >
                {g.title}
              </Typography>
              <List
                dense
                sx={{
                  width: "100%",
                  bgcolor: "background.paper",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                {sectionItems.map(([k, v], idx) => (
                  <React.Fragment key={k}>
                    <ListItem alignItems="flex-start" sx={{ py: 1 }}>
                      <ListItemText
                        primary={t(`employees.fields.${k}`, labelize(k))}
                        primaryTypographyProps={{
                          variant: "caption",
                          sx: {
                            color: "text.secondary",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          },
                        }}
                        secondary={
                          k === "PS" && v
                            ? posNameById.get(Number(v)) || v
                            : formatValue(k, v)
                        }
                        secondaryTypographyProps={{
                          variant: "body2",
                          sx: {
                            fontWeight: 600,
                            color: "text.primary",
                            wordBreak: "break-word",
                            mt: 0.25,
                          },
                        }}
                      />
                    </ListItem>
                    {idx < sectionItems.length - 1 && (
                      <Divider component="li" />
                    )}
                  </React.Fragment>
                ))}
              </List>
            </Box>
          );
        })}
        {otherEntries.length > 0 && (
          <Box>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, color: "text.primary", mb: 1 }}
            >
              {t("employees.sections.other", "Other")}
            </Typography>
            <List
              dense
              sx={{
                width: "100%",
                bgcolor: "background.paper",
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              {otherEntries.map(([k, v], idx) => (
                <React.Fragment key={k}>
                  <ListItem alignItems="flex-start" sx={{ py: 1 }}>
                    <ListItemText
                      primary={t(`employees.fields.${k}`, labelize(k))}
                      primaryTypographyProps={{
                        variant: "caption",
                        sx: {
                          color: "text.secondary",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        },
                      }}
                      secondary={
                        k === "PS" && v
                          ? posNameById.get(Number(v)) || v
                          : formatValue(k, v)
                      }
                      secondaryTypographyProps={{
                        variant: "body2",
                        sx: {
                          fontWeight: 600,
                          color: "text.primary",
                          wordBreak: "break-word",
                          mt: 0.25,
                        },
                      }}
                    />
                  </ListItem>
                  {idx < otherEntries.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))}
            </List>
          </Box>
        )}
      </Stack>
    );
  };

  const ProfileView = (
    <Box sx={{ p: 3, width: "100%" }}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Autocomplete
          size="small"
          options={(allEmployees && allEmployees.length ? allEmployees : data) as any}
          value={selected as any}
          onChange={(_, v) => setSelected((v as any) || null)}
          isOptionEqualToValue={(o: any, v: any) => Number(o?.ID_EMP) === Number(v?.ID_EMP)}
          getOptionLabel={(o: any) =>
            o
              ? `${o.NAME || ""}${o.ID_EMP != null ? ` (#${o.ID_EMP})` : ""}`
              : ""
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label={t("hr.profile.selectEmployee", "Select Employee")}
              placeholder={t("hr.profile.selectEmployeePlaceholder", "Type a name or ID")}
            />
          )}
        />
      </Paper>
      {selected ? (
        <Stack spacing={3}>
          <Card
            sx={{
              boxShadow: 3,
              borderRadius: 3,
              backgroundColor: "background.paper",
              border: "1px solid",
              borderColor: accent,
              transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: 6,
                borderColor: accent,
              },
            }}
          >
            <Box sx={{ p: 3 }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={3}
                alignItems={{ md: "center" }}
              >
                <Avatar
                  variant="square"
                  src={
                    (selected.PICTURE_URL ||
                      (selected.ID_EMP
                        ? `http://localhost:9000/api/employees/${selected.ID_EMP}/picture`
                        : undefined)) as string | undefined
                  }
                  sx={{
                    width: 112,
                    height: 112,
                    border: "2px solid",
                    borderColor: accent,
                    borderRadius: 0,
                    fontSize: 28,
                    fontWeight: 700,
                  }}
                />

                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="h4"
                    fontWeight={800}
                    sx={{ color: accent, mb: 0.5 }}
                  >
                    {selected.NAME}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                    {selected.TITLE && (
                      <Chip label={selected.TITLE} size="small" />
                    )}
                    {selected.PS && (
                      <Chip
                        size="small"
                        label={formatPs(selected.PS)}
                        sx={{ backgroundColor: accent, color: "white" }}
                      />
                    )}
                    <Chip
                      label={
                        isActiveEmployee(selected)
                          ? t("common.active", "Active")
                          : t("common.inactive", "Inactive")
                      }
                      color={isActiveEmployee(selected) ? "success" : "default"}
                      size="small"
                      variant={isActiveEmployee(selected) ? "filled" : "outlined"}
                    />
                    <FormControlLabel
                      sx={{ ml: 1 }}
                      control={
                        <Switch
                          size="small"
                          checked={selected.STATE === false ? false : true}
                          disabled={activeSaving}
                          onChange={(e) => handleToggleActive(e.target.checked)}
                        />
                      }
                      label={t("employees.fields.STATE", "Active")}
                    />

                    <FormControlLabel
                      sx={{ ml: 1 }}
                      control={
                        <Switch
                          size="small"
                          checked={Boolean(selected.FINGERPRINT_NEEDED)}
                          disabled={fingerprintSaving}
                          onChange={(e) => handleToggleFingerprint(e.target.checked)}
                        />
                      }
                      label={t("employees.fields.FINGERPRINT_NEEDED", "Fingerprint required")}
                    />
                  </Stack>
                </Box>
              </Stack>
            </Box>
          </Card>

          {coworkers.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography fontWeight={700}>
                {t("hr.profile.coworkers", "Coworkers (same job & level)")}
              </Typography>
              <Stack direction="row" flexWrap="wrap" spacing={2} useFlexGap>
                {coworkers.map((c: Employee) => (
                  <Stack
                    key={employeeKey(c)}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                  >
                    <Avatar
                      src={
                        (c.PICTURE_URL ||
                          (c.ID_EMP
                            ? `http://localhost:9000/api/employees/${c.ID_EMP}/picture`
                            : undefined)) as string | undefined
                      }
                      sx={{ width: 40, height: 40 }}
                    />
                    <Box>
                      <Typography fontWeight={700}>{c.NAME}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {c.TITLE}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          )}

          <SquareGrid cols={3}>
            <SquareCard title={t("hr.profile.contact", "Contact Information") as any}>
              <Box sx={{ display: "grid", gap: 2, width: "100%" }}>
                <Row
                  icon={<EmailIcon fontSize="small" />}
                  label={t("employees.fields.EMAIL", "Email")}
                  value={selected.EMAIL}
                />
                <Row
                  icon={<PhoneIcon fontSize="small" />}
                  label={t("employees.fields.PHONE", "Phone")}
                  value={selected.PHONE}
                />
                <Row
                  icon={<PhoneIcon fontSize="small" />}
                  label={t("employees.fields.EMERGENCY_CONTACT_PHONE", "Emergency")}
                  value={selected.EMERGENCY_CONTACT_PHONE}
                />
              </Box>
            </SquareCard>

            <SquareCard title={t("hr.profile.employment", "Employment Details") as any}>
              <Box sx={{ display: "grid", gap: 2, width: "100%" }}>
                <Row
                  icon={<BadgeIcon fontSize="small" />}
                  label={t("employees.fields.ID_EMP", "Employee ID")}
                  value={String(selected.ID_EMP ?? t("common.notSpecified", "—"))}
                />
                <Row
                  icon={<WorkOutlineIcon fontSize="small" />}
                  label={t("employees.fields.TITLE", "Title")}
                  value={selected.TITLE}
                />
                <Row
                  icon={<ApartmentIcon fontSize="small" />}
                  label={t("employees.fields.PS", "Point of Sale")}
                  value={selected.PS ? formatPs(selected.PS) : null}
                />
                <Row
                  icon={<CalendarMonthIcon fontSize="small" />}
                  label={t("hr.profile.contract", "Contract Period")}
                  value={`${fmtDate(selected.CONTRACT_START)} → ${fmtDate(selected.CONTRACT_END)}`}
                />
                <Row
                  icon={<CalendarMonthIcon fontSize="small" />}
                  label={t("hr.profile.schedule", "Schedule")}
                  value={
                    selected.T_START && selected.T_END
                      ? `${selected.T_START} → ${selected.T_END}`
                      : null
                  }
                />
              </Box>
            </SquareCard>

            <SquareCard title={t("employees.sections.compensation", "Compensation") as any}>
              <Box sx={{ display: "grid", gap: 2, width: "100%" }}>
                <Row
                  icon={<LocalAtmIcon fontSize="small" />}
                  label={t("employees.fields.BASIC_SALARY", "Basic Salary")}
                  value={currency(selected.BASIC_SALARY)}
                />
                <Row
                  icon={<LocalAtmIcon fontSize="small" />}
                  label={t("employees.fields.BASIC_SALARY_USD", "Salary (USD)")}
                  value={
                    selected.BASIC_SALARY_USD != null && Number(selected.BASIC_SALARY_USD) > 0
                      ? `${currency(selected.BASIC_SALARY_USD)} USD`
                      : null
                  }
                />
                <Row
                  icon={<LocalAtmIcon fontSize="small" />}
                  label={t("employees.fields.ACCOUNT_NUMBER", "Account")}
                  value={selected.ACCOUNT_NUMBER}
                />
              </Box>
            </SquareCard>

            <SquareCard title={t("hr.profile.personal", "Personal Information") as any}>
              <Box sx={{ display: "grid", gap: 2, width: "100%" }}>
                <Row
                  icon={<CalendarMonthIcon fontSize="small" />}
                  label={t("employees.fields.DATE_OF_BIRTH", "Date of Birth")}
                  value={fmtDate(selected.DATE_OF_BIRTH)}
                />
                <Row
                  icon={<BadgeIcon fontSize="small" />}
                  label={t("employees.fields.NATIONALITY", "Nationality")}
                  value={selected.NATIONALITY}
                />
                <Row
                  icon={<PersonAddIcon fontSize="small" />}
                  label={t("employees.fields.MARITAL_STATUS", "Marital Status")}
                  value={
                    selected.MARITAL_STATUS
                      ? t(`employees.enums.${selected.MARITAL_STATUS}`, selected.MARITAL_STATUS)
                      : null
                  }
                />
                <Row
                  icon={<ApartmentIcon fontSize="small" />}
                  label={t("employees.fields.ADDRESS", "Address")}
                  value={selected.ADDRESS}
                />
              </Box>
            </SquareCard>
          </SquareGrid>

          <Accordion
            sx={{
              border: "1px solid",
              borderColor: accent,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ bgcolor: "background.paper" }}
            >
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{ color: accent, display: "flex", alignItems: "center" }}
              >
                <BadgeIcon sx={{ mr: 1, color: accent }} />
                {t("hr.profile.allDetails", "Complete Employee Record")}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ pt: 1 }}>
                <AllDetails record={selected} />
              </Box>
            </AccordionDetails>
          </Accordion>
        </Stack>
      ) : (
        <Card
          sx={{
            boxShadow: 3,
            borderRadius: 3,
            backgroundColor: "background.paper",
            border: "2px dashed",
            borderColor: "divider",
            p: 6,
            textAlign: "center",
            transition: "transform 0.2s, box-shadow 0.2s",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: 6,
            },
          }}
        >
          <PersonAddIcon
            sx={{
              fontSize: { xs: 48, sm: 64 },
              color: "action.disabled",
              mb: 2,
            }}
          />
          <Typography
            variant="h5"
            sx={{ color: accent, fontWeight: 700, mb: 1 }}
          >
            {t("hr.profile.selectPrompt", "Select an Employee")}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t(
              "hr.profile.selectDescription",
              "Choose an employee from the Directory to view their complete profile and details."
            )}
          </Typography>
        </Card>
      )}
    </Box>
  );

  // ===== JSX =====
  return (
    <Box
      dir={theme.direction}
      sx={{
        bgcolor: "background.default",
        color: "text.primary",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        pt: "max(env(safe-area-inset-top, 0px), 16px)",
        px: { xs: 1, sm: 2, md: 3 },
        pb: { xs: 2, md: 3 },
        ml: theme.direction === "ltr" ? "var(--sidebar-width, 0px)" : 0,
        mr: theme.direction === "rtl" ? "var(--sidebar-width, 0px)" : 0,
      }}
    >
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          backdropFilter: "blur(8px)",
          backgroundImage: "none",
        }}
      >
        <Toolbar sx={{ gap: 1, flexWrap: "wrap" }}>
          <Typography
            variant="h6"
            fontWeight={900}
            sx={{ mr: 2, color: accent }}
          >
            {t("hr.header.title", "HR Workspace")}
          </Typography>

          <Paper
            sx={{
              display: "flex",
              alignItems: "center",
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              minWidth: 240,
              flex: 1,
            }}
            variant="outlined"
          >
            <TextField
              variant="standard"
              placeholder={t("hr.search.placeholder", "Search employees…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchEmployees()}
              fullWidth
              InputProps={{ disableUnderline: true }}
            />
          </Paper>

          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel id="state-label">
              {t("hr.filters.status", "Status")}
            </InputLabel>
            <Select
              labelId="state-label"
              label={t("hr.filters.status", "Status")}
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as any)}
              fullWidth
            >
              <MenuItem value="all">{t("common.all", "All")}</MenuItem>
              <MenuItem value="active">{t("common.active", "Active")}</MenuItem>
              <MenuItem value="inactive">
                {t("common.inactive", "Inactive")}
              </MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="point-of-sale-label">
              {t("hr.filters.pos", "Point of Sale")}
            </InputLabel>
            <Select
              labelId="point-of-sale-label"
              label={t("hr.filters.pos", "Point of Sale")}
              value={form.PS || ""}
              onChange={(e) => setField("PS", e.target.value as string)}
              fullWidth
            >
              <MenuItem value="">
                <em>{t("hr.filters.selectPOS", "Select a Point of Sale")}</em>
              </MenuItem>
              {pointsOfSale.map((pos) => (
                <MenuItem key={pos.Id_point} value={pos.Id_point.toString()}>
                  {pos.name_point}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Tooltip title={t("common.refresh", "Refresh")}>
            <IconButton onClick={fetchEmployees}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("common.export", "Export")}>
            <IconButton onClick={handleExportExcel}>
              <ImportExportIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            color="primary"
            onClick={openAdd}
            startIcon={<AddIcon />}
            sx={{ borderRadius: 2 }}
          >
            {t("hr.actions.new", "New")}
          </Button>
        </Toolbar>

        <Toolbar
          sx={{ borderTop: "1px solid", borderColor: "divider", gap: 1 }}
        >
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant={isMobile ? "scrollable" : "standard"}
          >
            <Tab
              icon={<GridViewIcon />}
              iconPosition="start"
              label={t("hr.tabs.directory", "Directory")}
            />
            <Tab
              icon={<BadgeIcon />}
              iconPosition="start"
              label={t("hr.tabs.profile", "Profile")}
            />
            <Tab
              icon={<ApartmentIcon />}
              iconPosition="start"
              label={t("hr.tabs.org", "Org Chart")}
            />
            <Tab
              icon={<AdminPanelSettingsIcon />}
              iconPosition="start"
              label={t("hr.tabs.roles", "Roles")}
            />
          </Tabs>
          <Box sx={{ flex: 1 }} />
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: "auto" }}>
        {loading && <LinearProgress />}
        {!loading && error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && (
          <>
            {tab === 0 &&
              (filteredEmployees.length === 0 ? (
                <EmptyState />
              ) : viewMode === "grid" ? (
                <DirectoryGrid />
              ) : (
                <DirectoryList />
              ))}
            {tab === 1 && ProfileView}

            {tab === 2 && (
              <Box sx={{ p: 2 }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography fontWeight={700}>
                        {t("hr.org.title", "Organization Chart")}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t("hr.org.activeOnly", "Showing active employees only")}
                      </Typography>
                    </Box>
                    <Chip
                      color="primary"
                      variant="outlined"
                      label={t("hr.org.activeCount", "{{count}} Active", {
                        count: orgActiveCount,
                      })}
                    />
                  </Stack>
                </Paper>
                {orgEmployees.length ? (
                  <OrgChartAll
                    employees={orgEmployees}
                    posNameById={posNameById}
                    onSelect={(e) => {
                      setSelected(e);
                      setTab(1);
                    }}
                    onReassign={(empId, newMgrId) =>
                      reassignEmployee(empId, newMgrId)
                    }
                  />
                ) : (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    {t("hr.org.emptyActive", "No active employees available to display.")}
                  </Alert>
                )}

                {inactiveEmployees.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                      {t("hr.org.inactiveBand", "Inactive Employees")}
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: "background.default",
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={2}
                        flexWrap="wrap"
                        useFlexGap
                        justifyContent="flex-start"
                      >
                        {inactiveEmployees.slice(0, 50).map((emp) => (
                          <Box
                            key={employeeKey(emp)}
                            sx={{
                              width: 220,
                              minHeight: 96,
                              border: "1px dashed",
                              borderColor: "divider",
                              borderRadius: 2,
                              position: "relative",
                              p: 1.5,
                              bgcolor: (theme) =>
                                theme.palette.mode === "dark"
                                  ? "action.selected"
                                  : "action.hover",
                              color: "text.secondary",
                              display: "flex",
                              alignItems: "center",
                              gap: 1.25,
                              filter: "grayscale(0.9)",
                            }}
                          >
                            <Box
                              sx={{
                                position: "absolute",
                                inset: 0,
                                pointerEvents: "none",
                                backgroundImage: `
                                  linear-gradient(45deg, transparent 48%, rgba(128,128,128,0.4) 49%, rgba(128,128,128,0.4) 51%, transparent 52%),
                                  linear-gradient(-45deg, transparent 48%, rgba(128,128,128,0.4) 49%, rgba(128,128,128,0.4) 51%, transparent 52%)
                                `,
                                opacity: 0.4,
                                borderRadius: 2,
                              }}
                            />
                            <Avatar
                              src={
                                (emp.PICTURE_URL ||
                                  (emp.ID_EMP ? `http://localhost:9000/api/employees/${emp.ID_EMP}/picture` : undefined)) as string | undefined
                              }
                              variant="rounded"
                              sx={{
                                width: 48,
                                height: 48,
                                border: "2px solid",
                                borderColor: "divider",
                                bgcolor: "grey.200",
                                color: "grey.600",
                              }}
                            >
                              {!emp.PICTURE_URL && !emp.ID_EMP ? <PersonOutlineOutlinedIcon  /> : null}
                            </Avatar>
                            <Box sx={{ zIndex: 1 }}>
                              <Typography
                                fontWeight={700}
                                sx={{
                                  color: "text.secondary",
                                  textDecoration: "line-through",
                                }}
                              >
                                {emp.NAME || t("common.unknown", "Unknown")}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {emp.TITLE || t("common.noTitle", "No title")}
                              </Typography>
                              <Typography variant="caption" color="text.disabled">
                                ID #{emp.ID_EMP || "—"}
                              </Typography>
                            </Box>
                            <Box
                              sx={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                color: "text.disabled",
                                fontWeight: 700,
                              }}
                            >
                              <CancelIcon fontSize="small" />
                              <Typography variant="caption">
                                {t("common.inactive", "Inactive")}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                        {inactiveEmployees.length > 50 && (
                          <Chip
                            label={t("hr.org.moreInactive", "+{{count}} more inactive", {
                              count: inactiveEmployees.length - 50,
                            })}
                            sx={{ alignSelf: "center" }}
                          />
                        )}
                      </Stack>
                    </Paper>
                  </Box>
                )}
              </Box>
            )}

            {tab === 3 && (
              <Box sx={{ p: 2 }}>
                <UsersDialog />
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Create / Edit Dialog */}
      <Dialog
        open={open}
        onClose={resetDialog}
        maxWidth={false}
        fullWidth
        keepMounted
        PaperProps={{ sx: DIALOG_PAPER_SX }}
      >
        <DialogTitle
          sx={{
            px: { xs: 2, sm: 4, md: 6 },
            py: { xs: 2, md: 2.5 },
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
            backgroundColor: "background.paper",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Tooltip title={t("common.previous", "Previous step") || ""}>
              <span>
                <IconButton
                  size="medium"
                  onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
                  disabled={step === 0}
                >
                  <ArrowBackIosNewIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Box>
              <Typography variant="overline" sx={{ display: "block", mb: 0.5 }}>
                {t("hr.dialog.step", {
                  defaultValue: "Step {{current}} of {{total}}",
                  current: step + 1,
                  total: steps.length,
                })}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {isEdit
                  ? t("hr.dialog.edit", "Edit Employee")
                  : t("hr.dialog.add", "Add New Employee")}
              </Typography>
            </Box>
            <Tooltip title={t("common.next", "Next step") || ""}>
              <span>
                <IconButton
                  size="medium"
                  onClick={() =>
                    setStep((prev) => Math.min(prev + 1, steps.length - 1))
                  }
                  disabled={step === steps.length - 1}
                >
                  <ArrowForwardIosIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
          <IconButton
            onClick={resetDialog}
            aria-label={t("common.close", "Close")}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {/* STEP 0: Basic & Personal */}
          {step === 0 && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <SquareGrid>
                <SquareCard
                  title={t("employees.sections.identity", "Identity")}
                >
                  <TextField
                    fullWidth
                    label={t("employees.fields.FIRST_NAME", "First Name")}
                    value={form.FIRST_NAME || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        FIRST_NAME: e.target.value,
                        NAME: `${e.target.value} ${prev.SURNAME || ""}`.trim(),
                      }))
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    fullWidth
                    label={t("employees.fields.SURNAME", "Surname")}
                    value={form.SURNAME || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        SURNAME: e.target.value,
                        NAME: `${prev.FIRST_NAME || ""} ${e.target.value}`.trim(),
                      }))
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    fullWidth
                    required
                    label={t("employees.fields.NAME", "Full Name")}
                    value={form.NAME || ""}
                    onChange={(e) => setField("NAME", e.target.value)}
                    error={!!errorsState.NAME}
                    helperText={errorsState.NAME}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    fullWidth
                    label={t(
                      "employees.fields.NAME_ENGLISH",
                      "Name in English"
                    )}
                    value={form.NAME_ENGLISH || ""}
                    onChange={(e) => setField("NAME_ENGLISH", e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </SquareCard>

                <SquareCard
                  title={t("employees.sections.demographics", "Demographics")}
                >
                  <SelectFixedWidth
                    label={t("employees.fields.GENDER", "Gender")}
                    value={form.GENDER || ""}
                    onChange={(v) => setField("GENDER", v)}
                    w={200}
                  >
                    <MenuItem value="Male">
                      {t("employees.enums.Male", "Male")}
                    </MenuItem>
                    <MenuItem value="Female">
                      {t("employees.enums.Female", "Female")}
                    </MenuItem>
                  </SelectFixedWidth>

                  <TextFixedWidth
                    label={t("employees.fields.DATE_OF_BIRTH", "Date of Birth")}
                    type="date"
                    value={toYMD(form.DATE_OF_BIRTH)}
                    onChange={(v) => setField("DATE_OF_BIRTH", v)}
                    w={200}
                  />
                  <TextField
                    fullWidth
                    label={t(
                      "employees.fields.PLACE_OF_BIRTH",
                      "Place of Birth"
                    )}
                    value={form.PLACE_OF_BIRTH || ""}
                    onChange={(e) => setField("PLACE_OF_BIRTH", e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <SelectFixedWidth
                    label={t("employees.fields.BLOOD_TYPE", "Blood Type")}
                    value={form.BLOOD_TYPE || ""}
                    onChange={(v) => setField("BLOOD_TYPE", v)}
                    w={100}
                  >
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                      (bt) => (
                        <MenuItem key={bt} value={bt}>
                          {bt}
                        </MenuItem>
                      )
                    )}
                  </SelectFixedWidth>
                </SquareCard>

                <SquareCard title={t("employees.sections.contact", "Contact")}>
                  <TextField
                    fullWidth
                    type="email"
                    label={t("employees.fields.EMAIL", "Email")}
                    value={form.EMAIL || ""}
                    onChange={(e) => setField("EMAIL", e.target.value)}
                    error={!!errorsState.EMAIL}
                    helperText={errorsState.EMAIL}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    fullWidth
                    label={t("employees.fields.PHONE", "Phone")}
                    value={form.PHONE || ""}
                    onChange={(e) => setField("PHONE", e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <SelectFixedWidth
                    label={t(
                      "employees.fields.MARITAL_STATUS",
                      "Marital Status"
                    )}
                    value={form.MARITAL_STATUS || ""}
                    onChange={(v) => setField("MARITAL_STATUS", v)}
                    w={200}
                  >
                    <MenuItem value="Single">
                      {t("employees.enums.Single", "Single")}
                    </MenuItem>
                    <MenuItem value="Married">
                      {t("employees.enums.Married", "Married")}
                    </MenuItem>
                    <MenuItem value="Divorced">
                      {t("employees.enums.Divorced", "Divorced")}
                    </MenuItem>
                    <MenuItem value="Widowed">
                      {t("employees.enums.Widowed", "Widowed")}
                    </MenuItem>
                  </SelectFixedWidth>
                  <TextFixedWidth
                    label={t("employees.fields.NUM_OF_CHILDREN", "Children")}
                    type="number"
                    value={form.NUM_OF_CHILDREN ?? ""}
                    onChange={(v) =>
                      setField("NUM_OF_CHILDREN", v === "" ? null : Number(v))
                    }
                    w={100}
                  />
                </SquareCard>

                <SquareCard
                  title={t(
                    "employees.sections.address",
                    "Address & Nationality"
                  )}
                >
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label={t("employees.fields.ADDRESS", "Address")}
                    value={form.ADDRESS || ""}
                    onChange={(e) => setField("ADDRESS", e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <SelectFixedWidth
                    label={t("employees.fields.NATIONALITY", "Nationality")}
                    value={form.NATIONALITY || ""}
                    onChange={(v) =>
                      setForm((prev) => ({
                        ...prev,
                        NATIONALITY: v,
                        IS_FOREINGHT:
                          String(v || "").toLowerCase() !== "libyan",
                      }))
                    }
                    w={200}
                  >
                    {NATIONALITIES.map((n) => (
                      <MenuItem key={n} value={n}>
                        {n}
                      </MenuItem>
                    ))}
                  </SelectFixedWidth>
                </SquareCard>
              </SquareGrid>

              <SquareGrid>
                <SquareCard
                  title={t("employees.sections.emergency", "Emergency")}
                >
                  <TextField
                    fullWidth
                    label={t(
                      "employees.fields.EMERGENCY_CONTACT_RELATION",
                      "Relation"
                    )}
                    value={form.EMERGENCY_CONTACT_RELATION || ""}
                    onChange={(e) =>
                      setField("EMERGENCY_CONTACT_RELATION", e.target.value)
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    fullWidth
                    label={t(
                      "employees.fields.EMERGENCY_CONTACT_PHONE",
                      "Phone"
                    )}
                    value={form.EMERGENCY_CONTACT_PHONE || ""}
                    onChange={(e) =>
                      setField("EMERGENCY_CONTACT_PHONE", e.target.value)
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </SquareCard>

                <SquareCard title={t("employees.sections.notes", "Notes")}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label={t("employees.fields.COMMENT", "Comments")}
                    value={form.COMMENT || ""}
                    onChange={(e) => setField("COMMENT", e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    label={t(
                      "employees.fields.MEDICAL_COMMENT",
                      "Medical Comments"
                    )}
                    value={form.MEDICAL_COMMENT || ""}
                    onChange={(e) =>
                      setField("MEDICAL_COMMENT", e.target.value)
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </SquareCard>

                <SquareCard title={t("employees.sections.attendance", "Working Days & Hours")}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">{t('hr.attendance.header','Attendance')}</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CalendarMonthIcon />}
                  onClick={() => openSchedFor(
                    Number((form as any).ID_EMP || (form as any).id_emp || 0),
                    String((form as any).NAME || (form as any).name || ''),
                    (form as any).T_START || null,
                    (form as any).T_END || null,
                  )}
                >
                  {t('hr.attendance.editTimes','Edit Employee Times')}
                </Button>
              </Box>
              <FormControl component="fieldset" sx={{ mb: 1 }}>
                <FormLabel>{t('hr.attendance.mode','Mode')}</FormLabel>
                <RadioGroup row value={attUseProfile ? 'profile' : 'custom'} onChange={(_,v)=> setAttUseProfile(v==='profile')}>
                  <FormControlLabel value="profile" control={<Radio size="small"/>} label={t('hr.attendance.useProfile','Use Profile')||'Use Profile'} />
                  <FormControlLabel value="custom" control={<Radio size="small"/>} label={t('hr.attendance.custom','Custom')||'Custom'} />
                </RadioGroup>
              </FormControl>

                  {attUseProfile ? (
                    <Box sx={{ display:'flex', alignItems:'center', gap:2 }}>
                      <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel>{t('hr.attendance.profile','Profile')}</InputLabel>
                        <Select
                          label={t('hr.attendance.profile','Profile')}
                          value={attProfileName}
                          onChange={(e)=> setAttProfileName(String(e.target.value))}
                        >
                          <MenuItem value="">{t('common.none','None')}</MenuItem>
                          {attendanceProfiles.map(p => (
                            <MenuItem key={p.name} value={p.name}>{p.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button variant="outlined" size="small" onClick={()=> setAttMgrOpen(true)}>{t('hr.attendance.manageProfiles','Manage Profiles')}</Button>
                    </Box>
                  ) : (
                    <>
                      <FormLabel sx={{ mt: 1 }}>{t('hr.attendance.days','Days')}</FormLabel>
                      <FormGroup row>
                        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                          <FormControlLabel key={d} control={<Checkbox checked={attDays.has(d)} onChange={()=>toggleDay(d)} />} label={d} />
                        ))}
                      </FormGroup>
                      <Box sx={{ display:'flex', gap:2, mt: 1 }}>
                        <TextField label={t('hr.attendance.start','Start')} type="time" value={attStart} onChange={(e)=> setAttStart(e.target.value)} inputProps={{ step: 60 }} />
                        <TextField label={t('hr.attendance.end','End')} type="time" value={attEnd} onChange={(e)=> setAttEnd(e.target.value)} inputProps={{ step: 60 }} />
                      </Box>
                    </>
                  )}
                  <FormHelperText>{t('hr.attendance.help','Profiles let you group many employees under the same schedule; custom overrides profile.')}</FormHelperText>
                </SquareCard>
              </SquareGrid>
            </Stack>
          )}

          {/* STEP 1: Employment + Compensation + Financial — simplified */}
          {step === 1 && (
            <Box sx={{ p: 2, maxWidth: 1400, mx: "auto" }}>
              <Stack spacing={3}>
                {/* 2x2 tiles: Assignment / Manager, Contract, Insurance, Salary */}
                <Stack direction="row" flexWrap="wrap" gap={2}>
                  {/* Assignment & Position */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      flex: "1 1 360px",
                      minWidth: 340,
                    }}
                  >
                    <SectionHeading>
                      {t(
                        "employees.sections.assignment",
                        "Assignment & Position"
                      )}
                    </SectionHeading>

                    {/* Cost center/Department */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        mb: 1.5,
                      }}
                    >
                      <FormControl>
                        <InputLabel>
                          {t("employees.fields.COST_CENTER", "Department")}
                        </InputLabel>
                        <Select
                          label={t(
                            "employees.fields.COST_CENTER",
                            "Department"
                          )}
                          value={form.COST_CENTER || ""}
                          onChange={(e) =>
                            setField("COST_CENTER", e.target.value)
                          }
                          sx={{ width: 200 }}
                        >
                          {departments.map((dep) => (
                            <MenuItem key={dep} value={dep}>
                              {dep}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {/* Point of Sale */}
                      <FormControl>
                        <InputLabel>
                          {t("employees.fields.PS", "Point of Sale")}
                        </InputLabel>
                        <Select
                          label={t("employees.fields.PS", "Point of Sale")}
                          value={form.PS || ""}
                          onChange={(e) => setField("PS", e.target.value)}
                          sx={{ width: 200 }}
                        >
                          {pointsOfSale.map((pos) => (
                            <MenuItem key={pos.Id_point} value={pos.Id_point}>
                              {pos.name_point}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>

                    {/* Position + add icon */}
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                      <FormControl>
                        <InputLabel>
                          {t("employees.fields.POSITION", "Position")}
                        </InputLabel>
                        <Select
                          label={t("employees.fields.POSITION", "Position")}
                          value={form.TITLE || ""}
                          onChange={(e) => handleChangeTitle(String(e.target.value))}
                          sx={{ width: 200 }}
                        >
                          {jobs.map((j) => (
                            <MenuItem key={j.id_job} value={j.Job_title}>
                              {`${j.Job_title} (${j.job_name})`}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <Tooltip
                        title={t("hr.jobs.create", "Create Position") || ""}
                      >
                        <IconButton
                          color="primary"
                          onClick={() => setJobDialogOpen(true)}
                          size="small"
                          sx={{ border: "1px dashed", borderColor: "divider" }}
                        >
                          <AddIcon />
                        </IconButton>
                      </Tooltip>

                      {form.TITLE && (
                        <Chip
                          size="small"
                          sx={{ ml: 1 }}
                          label={t("hr.jobs.appliesTitle", {
                            defaultValue: "Selected: {{t}}",
                            t: form.TITLE,
                          })}
                        />
                      )}
                    </Box>
                  </Paper>

                  {/* Manager & Contract */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      flex: "1 1 360px",
                      minWidth: 340,
                    }}
                  >
                    <SectionHeading>
                      {t(
                        "employees.sections.managerContract",
                        "Manager & Contract"
                      )}
                    </SectionHeading>

                    {/* Manager */}
                    <Autocomplete
                      options={[
                        {
                          ID_EMP: null,
                          NAME: t("employees.none", "No manager"),
                        } as any,
                        ...allEmployees,
                      ]}
                      getOptionLabel={(o: any) =>
                        o?.ID_EMP
                          ? `${o.NAME}${o.TITLE ? ` — ${o.TITLE}` : ""}`
                          : String(o?.NAME || "")
                      }
                      isOptionEqualToValue={(a, b) =>
                        String(a?.ID_EMP || "") === String(b?.ID_EMP || "")
                      }
                      value={
                        allEmployees.find(
                          (e) =>
                            String(e.ID_EMP || "") ===
                            String(form.JOB_RELATION || "")
                        ) ||
                        ({
                          ID_EMP: null,
                          NAME: t("employees.none", "No manager"),
                        } as any)
                      }
                      onChange={(_e, val: any) =>
                        setField(
                          "JOB_RELATION",
                          val?.ID_EMP ? String(val.ID_EMP) : ""
                        )
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          fullWidth
                          label={t("employees.fields.MANAGER_ID", "Manager")}
                        />
                      )}
                      sx={{ mb: 1.5 }}
                    />

                    {/* Contract dates */}
                    <Box sx={{ display: "flex", gap: 2 }}>
                      <TextField
                        fullWidth
                        required
                        label={t(
                          "employees.fields.CONTRACT_START",
                          "Contract Start"
                        )}
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        value={toYMD(form.CONTRACT_START)}
                        onChange={(e) =>
                          setField("CONTRACT_START", e.target.value)
                        }
                        error={!!errorsState.CONTRACT_START}
                        helperText={errorsState.CONTRACT_START || ""}
                      />
                      <TextField
                        fullWidth
                        label={t(
                          "employees.fields.CONTRACT_END",
                          "Contract End (Optional)"
                        )}
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        value={toYMD(form.CONTRACT_END)}
                        onChange={(e) =>
                          setField("CONTRACT_END", e.target.value)
                        }
                        error={!!errorsState.CONTRACT_END}
                        helperText={
                          errorsState.CONTRACT_END ||
                          t(
                            "hr.hints.contractEndOptional",
                            "Leave empty for open-ended"
                          )
                        }
                      />
                    </Box>
                  </Paper>

                  {/* Insurance & Banking */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      flex: "1 1 360px",
                      minWidth: 340,
                    }}
                  >
                    <SectionHeading>
                      {t(
                        "employees.sections.insuranceBank",
                        "Insurance & Banking"
                      )}
                    </SectionHeading>

                    <Box
                      sx={{
                        display: "flex",
                        gap: 2,
                        alignItems: "center",
                        mb: 1.5,
                      }}
                    >
                      {/* Type of insurance: full | partial */}
                      <FormControl>
                        <InputLabel>
                          {t(
                            "employees.fields.TYPE_OF_INSURANCE",
                            "Type of Insurance"
                          )}
                        </InputLabel>
                        <Select
                          label={t(
                            "employees.fields.TYPE_OF_INSURANCE",
                            "Type of Insurance"
                          )}
                          value={form.TYPE_OF_INSURANCE || ""}
                          onChange={(e) =>
                            setField("TYPE_OF_INSURANCE", e.target.value)
                          }
                          sx={{ width: 200 }}
                        >
                          <MenuItem value="full">
                            {t("employees.insurance.full", "full")}
                          </MenuItem>
                          <MenuItem value="partial">
                            {t("employees.insurance.partial", "partial")}
                          </MenuItem>
                        </Select>
                      </FormControl>

                      <TextField
                        label={t(
                          "employees.fields.NUM_OF_INSURANCE",
                          "Insurance No."
                        )}
                        value={form.NUM_OF_INSURANCE || ""}
                        onChange={(e) =>
                          setField("NUM_OF_INSURANCE", e.target.value)
                        }
                        sx={{ width: 200 }}
                      />
                    </Box>

                    <Box sx={{ display: "flex", gap: 2 }}>
                      <TextField
                        label={t("employees.fields.BANK", "Bank (ID)")}
                        type="number"
                        value={form.BANK ?? ""}
                        onChange={(e) =>
                          setField(
                            "BANK",
                            e.target.value === ""
                              ? null
                              : Number(e.target.value)
                          )
                        }
                        sx={{ width: 100 }}
                      />
                      <TextField
                        label={t(
                          "employees.fields.ACCOUNT_NUMBER",
                          "Account Number"
                        )}
                        value={form.ACCOUNT_NUMBER || ""}
                        onChange={(e) =>
                          setField("ACCOUNT_NUMBER", e.target.value)
                        }
                        sx={{ width: 200 }}
                      />
                    </Box>
                  </Paper>

                  {/* Salary */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      flex: "1 1 360px",
                      minWidth: 340,
                    }}
                  >
                    <SectionHeading>
                      {t("hr.compensation.title", "Compensation")}
                    </SectionHeading>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={salaryInUSD}
                          onChange={(_, v) => setSalaryInUSD(v)}
                        />
                      }
                      label={t("hr.compensation.usdToggle", "Salary in USD")}
                      sx={{ mb: 1 }}
                    />

                    {!salaryInUSD && (
                      <TextField
                        fullWidth
                        label={t(
                          "employees.fields.BASIC_SALARY",
                          "Monthly Base Salary (LYD)"
                        )}
                        type="number"
                        value={form.BASIC_SALARY ?? ""}
                        onChange={(e) =>
                          setField(
                            "BASIC_SALARY",
                            e.target.value === ""
                              ? null
                              : Number(e.target.value)
                          )
                        }
                        helperText={t(
                          "hr.hints.baseSalary",
                          "Fixed monthly salary"
                        )}
                      />
                    )}

                    {salaryInUSD && (
                      <Box sx={{ display: "flex", gap: 2 }}>
                        <TextField
                          fullWidth
                          label={t(
                            "employees.fields.BASIC_SALARY_USD",
                            "Monthly Base Salary (USD)"
                          )}
                          type="number"
                          value={(form as any).BASIC_SALARY_USD ?? ""}
                          onChange={(e) =>
                            setField(
                              "BASIC_SALARY_USD",
                              e.target.value === ""
                                ? null
                                : Number(e.target.value)
                            )
                          }
                          helperText={t(
                            "hr.hints.baseSalaryUsd",
                            "Paid in USD"
                          )}
                        />
                        <TextField
                          label={t(
                            "employees.fields.BASIC_SALARY",
                            "Base (LYD, optional)"
                          )}
                          type="number"
                          value={form.BASIC_SALARY ?? ""}
                          onChange={(e) =>
                            setField(
                              "BASIC_SALARY",
                              e.target.value === ""
                                ? null
                                : Number(e.target.value)
                            )
                          }
                          sx={{ width: 200 }}
                        />
                      </Box>
                    )}

                    {/* Seller user mapping for Seller Reports */}
                    <Box sx={{ mt: 2, display:'flex', gap:2, alignItems:'center', flexWrap:'wrap' }}>
                      <FormControl size="small" sx={{ minWidth: 260 }}>
                        <InputLabel>{t('hr.compensation.sellerUser','Seller User')}</InputLabel>
                        <Select
                          label={t('hr.compensation.sellerUser','Seller User')}
                          value={sellerUserId ?? ''}
                          onChange={(e)=> {
                            const raw = String(e.target.value ?? '');
                            setSellerUserId(raw === '' ? null : Number(raw));
                          }}
                        >
                          <MenuItem value="">{t('common.none','None')}</MenuItem>
                          {sellerUsers.map(u => (
                            <MenuItem key={u.id_user} value={u.id_user}>{u.name_user}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormHelperText sx={{ ml: 0 }}>{t('hr.compensation.sellerUserHelp','Used to link Sales to this employee for commissions in payslips.')}</FormHelperText>
                    </Box>

                    {/* Commission Role */}
                    <Box sx={{ mt: 1, display:'flex', gap:2, alignItems:'center', flexWrap:'wrap' }}>
                      <FormControl size="small" sx={{ minWidth: 260 }}>
                        <InputLabel>{t('hr.compensation.role','Commission Role')}</InputLabel>
                        <Select
                          label={t('hr.compensation.role','Commission Role')}
                          value={commissionRole}
                          onChange={(e)=> setCommissionRole(String(e.target.value))}
                        >
                          <MenuItem value="">{t('common.none','None')}</MenuItem>
                          <MenuItem value="sales_rep">Sales Rep</MenuItem>
                          <MenuItem value="senior_sales_rep">Senior Sales Rep</MenuItem>
                          <MenuItem value="sales_lead">Sales Lead</MenuItem>
                          <MenuItem value="sales_manager">Sales Manager</MenuItem>
                        </Select>
                      </FormControl>
                      <FormHelperText sx={{ ml: 0 }}>{t('hr.compensation.roleHelp','Determines gold per-gram and diamond % commission rules.')}</FormHelperText>
                    </Box>

                    {(commissionRole === 'sales_lead' || commissionRole === 'sales_manager') && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>{t('hr.compensation.psScope','PS Scope (branches)')}</Typography>
                        <Autocomplete
                          multiple
                          options={posOptions}
                          disableCloseOnSelect
                          getOptionLabel={(o:any)=> o?.name_point || String(o?.Id_point || '')}
                          value={posOptions.filter(p=> commissionPs.includes(Number(p.Id_point)))}
                          onChange={(_e, vals:any[])=> setCommissionPs(vals.map(v=> Number(v.Id_point)).filter(n=> Number.isFinite(n)))}
                          renderInput={(params)=> (
                            <TextField {...params} size="small" placeholder={t('hr.compensation.selectPs','Select branches/PS')} />
                          )}
                          renderTags={(value:any[], getTagProps)=> (
                            value.map((option:any, index:number)=> (
                              <Chip {...getTagProps({ index })} key={option.Id_point} label={option.name_point || option.Id_point} size="small" />
                            ))
                          )}
                        />
                        <FormHelperText>{t('hr.compensation.psScopeHelp','For leads/managers: grams will be summed from these branches for gold commissions.')}</FormHelperText>
                      </Box>
                    )}

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 1, display: "block" }}
                    >
                      {t(
                        "hr.hints.allowancesDaily",
                        "Allowances are daily and will be multiplied by working days later."
                      )}
                    </Typography>

                    <Box
                      sx={{
                        display: "flex",
                        gap: 2,
                        mt: 1.5,
                        flexWrap: "wrap",
                      }}
                    >
                      <TextField
                        label={t("employees.fields.FOOD", "Food/day")}
                        type="number"
                        value={form.FOOD ?? ""}
                        onChange={(e) =>
                          setField(
                            "FOOD",
                            e.target.value === ""
                              ? null
                              : Number(e.target.value)
                          )
                        }
                        sx={{ width: 200 }}
                      />
                      <TextField
                        label={t("employees.fields.FUEL", "Fuel/day")}
                        type="number"
                        value={form.FUEL ?? ""}
                        onChange={(e) =>
                          setField(
                            "FUEL",
                            e.target.value === ""
                              ? null
                              : Number(e.target.value)
                          )
                        }
                        sx={{ width: 200 }}
                      />
                      <TextField
                        label={t(
                          "employees.fields.COMMUNICATION",
                          "Communication/day"
                        )}
                        type="number"
                        value={form.COMMUNICATION ?? ""}
                        onChange={(e) =>
                          setField(
                            "COMMUNICATION",
                            e.target.value === ""
                              ? null
                              : Number(e.target.value)
                          )
                        }
                        sx={{ width: 200 }}
                      />
                    </Box>

                    {/* Commissions */}
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 2 }}>
                      {t("hr.compensation.commissions", "Commissions")}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mt: 1 }}>
                      {/* Gold Commission */}
                      <FormControl>
                        <FormLabel>{t("hr.compensation.goldCommission", "Gold Commission")}</FormLabel>
                        <RadioGroup
                          row
                          value={(form as any).GOLD_COMM || "none"}
                          onChange={(_, val) => {
                            setForm(prev => ({
                              ...prev,
                              GOLD_COMM: val === 'none' ? '' : val,
                              GOLD_COMM_VALUE: val === 'none' ? null : (prev.GOLD_COMM_VALUE ?? 0),
                            } as any));
                          }}
                        >
                          <FormControlLabel value="none" control={<Radio size="small" />} label={t('common.none','None')} />
                          <FormControlLabel value="percent" control={<Radio size="small" />} label={t('hr.compensation.percent','Percent')} />
                          <FormControlLabel value="fixed" control={<Radio size="small" />} label={t('hr.compensation.fixed','Fixed')} />
                        </RadioGroup>
                        {((form as any).GOLD_COMM === 'percent' || (form as any).GOLD_COMM === 'fixed') && (
                          <TextField
                            sx={{ mt: 1, width: 220 }}
                            type="number"
                            label={(form as any).GOLD_COMM === 'percent' ? t('hr.compensation.goldPercent','Gold %') : t('hr.compensation.goldFixed','Gold Fixed (LYD)')}
                            value={(form as any).GOLD_COMM_VALUE ?? ''}
                            onChange={(e) => setField('GOLD_COMM_VALUE', e.target.value === '' ? null : Number(e.target.value))}
                            inputProps={{ step: (form as any).GOLD_COMM === 'percent' ? 0.1 : 1 }}
                          />
                        )}
                      </FormControl>

                      {/* Diamond Commission */}
                      <FormControl>
                        <FormLabel>{t("hr.compensation.diamondCommission", "Diamond Commission")}</FormLabel>
                        <RadioGroup
                          row
                          value={(form as any).DIAMOND_COMM_TYPE || "none"}
                          onChange={(_, val) => {
                            setForm(prev => ({
                              ...prev,
                              DIAMOND_COMM_TYPE: val === 'none' ? '' : val,
                              DIAMOND_COMM: val === 'none' ? null : ((prev as any).DIAMOND_COMM ?? 0),
                            } as any));
                          }}
                        >
                          <FormControlLabel value="none" control={<Radio size="small" />} label={t('common.none','None')} />
                          <FormControlLabel value="percent" control={<Radio size="small" />} label={t('hr.compensation.percent','Percent')} />
                          <FormControlLabel value="fixed" control={<Radio size="small" />} label={t('hr.compensation.fixed','Fixed')} />
                        </RadioGroup>
                        {(((form as any).DIAMOND_COMM_TYPE === 'percent') || ((form as any).DIAMOND_COMM_TYPE === 'fixed')) && (
                          <TextField
                            sx={{ mt: 1, width: 220 }}
                            type="number"
                            label={(form as any).DIAMOND_COMM_TYPE === 'percent' ? t('hr.compensation.diamondPercent','Diamond %') : t('hr.compensation.diamondFixed','Diamond Fixed (LYD)')}
                            value={(form as any).DIAMOND_COMM ?? ''}
                            onChange={(e) => setField('DIAMOND_COMM', e.target.value === '' ? null : Number(e.target.value))}
                            inputProps={{ step: (form as any).DIAMOND_COMM_TYPE === 'percent' ? 0.1 : 1 }}
                          />
                        )}
                      </FormControl>
                    </Box>
                  </Paper>
                </Stack>
              </Stack>
            </Box>
          )}

          {/* STEP 2: Identification, IDs & Work Timing + Photo + Insurance/Finance */}
          {step === 2 && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <SquareGrid>
                <SquareCard
                  title={t("employees.sections.photo", "Photo")}
                  minH={180}
                >
                  <Grid container spacing={2} alignItems="flex-start">
                    {/* LEFT SIDE — IDs, Passports, Certificates */}
                    <Grid>
                      <Grid container spacing={2}>
                        <Grid>
                          <TextFixedWidth
                            label={t("employees.fields.NUM_CIN", "CIN")}
                            placeholder="رقم بطاقة التعريف الوطنية"
                            value={form.NUM_CIN || ""}
                            onChange={(v) => setField("NUM_CIN", v)}
                          />
                        </Grid>

                        <Grid>
                          <TextFixedWidth
                            label={t(
                              "employees.fields.NUM_NATIONAL",
                              "National #"
                            )}
                            placeholder="الرقم الوطني"
                            value={form.NUM_NATIONAL || ""}
                            onChange={(v) => setField("NUM_NATIONAL", v)}
                          />
                        </Grid>

                        <Grid>
                          <TextFixedWidth
                            label={t(
                              "employees.fields.ISSUING_AUTH",
                              "Issuing Auth"
                            )}
                            placeholder="جهة الإصدار"
                            value={form.ISSUING_AUTH || ""}
                            onChange={(v) => setField("ISSUING_AUTH", v)}
                            w={200}
                          />
                        </Grid>

                        <Grid>
                          <TextFixedWidth
                            label={t(
                              "employees.fields.FAM_BOOK_NUM",
                              "Family Book #"
                            )}
                            placeholder="رقم دفتر العائلة"
                            value={form.FAM_BOOK_NUM || ""}
                            onChange={(v) => setField("FAM_BOOK_NUM", v)}
                          />
                        </Grid>

                        <Grid>
                          <TextFixedWidth
                            label={t(
                              "employees.fields.FAM_BOOK_ISSUING_AUTH",
                              "Family Book Auth"
                            )}
                            placeholder="جهة إصدار دفتر العائلة"
                            value={form.FAM_BOOK_ISSUING_AUTH || ""}
                            onChange={(v) =>
                              setField("FAM_BOOK_ISSUING_AUTH", v)
                            }
                            w={200}
                          />
                        </Grid>

                        <Grid>
                          <TextFixedWidth
                            label={t(
                              "employees.fields.PASSPORT_NUM",
                              "Passport #"
                            )}
                            placeholder="رقم جواز السفر"
                            value={form.PASSPORT_NUM || ""}
                            onChange={(v) => setField("PASSPORT_NUM", v)}
                          />
                        </Grid>

                        <Grid>
                          <TextFixedWidth
                            label={t(
                              "employees.fields.PASSPORT_ISSUING_AUTH",
                              "Passport Auth"
                            )}
                            placeholder="جهة إصدار جواز السفر"
                            value={form.PASSPORT_ISSUING_AUTH || ""}
                            onChange={(v) =>
                              setField("PASSPORT_ISSUING_AUTH", v)
                            }
                            w={200}
                          />
                        </Grid>

                        <Grid>
                          <TextFixedWidth
                            label={t(
                              "employees.fields.DRIVER_LIC_NUM",
                              "Driver License #"
                            )}
                            placeholder="رقم رخصة القيادة"
                            value={form.DRIVER_LIC_NUM || ""}
                            onChange={(v) => setField("DRIVER_LIC_NUM", v)}
                          />
                        </Grid>

                        <Grid>
                          <FormControl fullWidth size="small">
                            <Select
                              value={form.SCIENTIFIC_CERT || ""}
                              onChange={(e) =>
                                setField("SCIENTIFIC_CERT", e.target.value)
                              }
                              displayEmpty
                            >
                              <MenuItem value="">
                                <em>اختر المؤهل العلمي</em>
                              </MenuItem>
                              {SCIENTIFIC_CERTIFICATES.map((cert) => (
                                <MenuItem key={cert} value={cert}>
                                  {t(
                                    `employees.certs.${cert.replace(/\s+/g, "")}`,
                                    cert
                                  )}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </Grid>

                    {/* RIGHT SIDE — Photo */}
                    <Grid>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          p: 2,
                          border: (theme) =>
                            `1px solid ${theme.palette.divider}`,
                          borderRadius: 1,
                          bgcolor: (theme) =>
                            theme.palette.mode === "dark"
                              ? "rgba(255,255,255,0.04)"
                              : "#fff",
                        }}
                      >
                        <Avatar
                          variant="rounded"
                          src={photoPreview || form.PICTURE_URL || undefined}
                          sx={{ width: 96, height: 96 }}
                        />
                        <Stack spacing={1}>
                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              {t("employees.actions.uploadPhoto", "Upload")}
                            </Button>
                            {(photoPreview || form.PICTURE_URL) && (
                              <Button
                                color="error"
                                variant="text"
                                size="small"
                                onClick={() => onPhotoChange(null)}
                              >
                                {t("employees.actions.removePhoto", "Remove")}
                              </Button>
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            ‎الحد الأدنى للحجم ٢٥٦×٢٥٦ بكسل (JPG / PNG)
                          </Typography>
                        </Stack>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            onPhotoChange(f);
                            if (fileInputRef.current)
                              fileInputRef.current.value = "";
                          }}
                        />
                      </Box>
                    </Grid>
                  </Grid>
                </SquareCard>

                <SquareCard
                  title={t(
                    "employees.sections.workTiming",
                    "Work Timing & Status"
                  )}
                  minH={240}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t("employees.timing.selectDays", "Select Working Days")}
                  </Typography>

                  <Box
                    sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}
                  >
                    {[
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                      "Sunday",
                    ].map((day) => (
                      <Chip
                        key={day}
                        label={t(`employees.days.${day}`, day)}
                        onClick={() => {
                          setSelectedDays((prev) => {
                            const newSet = new Set(prev);
                            if (newSet.has(day)) {
                              newSet.delete(day);
                            } else {
                              newSet.add(day);
                            }
                            return newSet;
                          });
                        }}
                        color={selectedDays.has(day) ? "primary" : "default"}
                        variant={selectedDays.has(day) ? "filled" : "outlined"}
                      />
                    ))}
                  </Box>

                  {selectedDays.size > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {t(
                          "employees.timing.addTimeSlots",
                          "Add Time Slots for Selected Days"
                        )}
                      </Typography>

                      {scheduleSlots.map((slot, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            mb: 2,
                            p: 1.5,
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                          }}
                        >
                          <Stack spacing={1}>
                            {slot.timeSlots.map((timeSlot, tsIdx) => (
                              <Box
                                key={tsIdx}
                                sx={{
                                  display: "flex",
                                  gap: 1,
                                  alignItems: "center",
                                }}
                              >
                                <TextField
                                  type="time"
                                  label={t("employees.timing.start", "Start")}
                                  placeholder="09:00"
                                  InputLabelProps={{ shrink: true }}
                                  value={timeSlot.start}
                                  onChange={(e) => {
                                    setScheduleSlots((prev) =>
                                      prev.map((s, i) =>
                                        i === idx
                                          ? {
                                              ...s,
                                              timeSlots: s.timeSlots.map(
                                                (ts, j) =>
                                                  j === tsIdx
                                                    ? {
                                                        ...ts,
                                                        start: e.target.value,
                                                      }
                                                    : ts
                                              ),
                                            }
                                          : s
                                      )
                                    );
                                  }}
                                  sx={{ width: 140 }}
                                />
                                <TextField
                                  type="time"
                                  label={t("employees.timing.end", "End")}
                                  placeholder="17:00"
                                  InputLabelProps={{ shrink: true }}
                                  value={timeSlot.end}
                                  onChange={(e) => {
                                    setScheduleSlots((prev) =>
                                      prev.map((s, i) =>
                                        i === idx
                                          ? {
                                              ...s,
                                              timeSlots: s.timeSlots.map(
                                                (ts, j) =>
                                                  j === tsIdx
                                                    ? {
                                                        ...ts,
                                                        end: e.target.value,
                                                      }
                                                    : ts
                                              ),
                                            }
                                          : s
                                      )
                                    );
                                  }}
                                  sx={{ width: 140 }}
                                />
                                <FormControl sx={{ width: 140 }}>
                                  <InputLabel>
                                    {t("employees.timing.type", "Type")}
                                  </InputLabel>
                                  <Select
                                    value={timeSlot.type}
                                    onChange={(e) => {
                                      setScheduleSlots((prev) =>
                                        prev.map((s, i) =>
                                          i === idx
                                            ? {
                                                ...s,
                                                timeSlots: s.timeSlots.map(
                                                  (ts, j) =>
                                                    j === tsIdx
                                                      ? {
                                                          ...ts,
                                                          type: e.target
                                                            .value as any,
                                                        }
                                                      : ts
                                                ),
                                              }
                                            : s
                                        )
                                      );
                                    }}
                                  >
                                    <MenuItem value="Employment">
                                      {t(
                                        "employees.timing.employment",
                                        "Employment"
                                      )}
                                    </MenuItem>
                                    <MenuItem value="Education">
                                      {t(
                                        "employees.timing.education",
                                        "Education"
                                      )}
                                    </MenuItem>
                                  </Select>
                                </FormControl>
                                <TextField
                                  label={t("employees.timing.note", "Note")}
                                  placeholder={t(
                                    "employees.timing.notePlaceholder",
                                    "ملاحظات إضافية"
                                  )}
                                  value={timeSlot.note || ""}
                                  onChange={(e) => {
                                    setScheduleSlots((prev) =>
                                      prev.map((s, i) =>
                                        i === idx
                                          ? {
                                              ...s,
                                              timeSlots: s.timeSlots.map(
                                                (ts, j) =>
                                                  j === tsIdx
                                                    ? {
                                                        ...ts,
                                                        note: e.target.value,
                                                      }
                                                    : ts
                                              ),
                                            }
                                          : s
                                      )
                                    );
                                  }}
                                  sx={{ flex: 1 }}
                                />
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setScheduleSlots((prev) =>
                                      prev
                                        .map((s, i) =>
                                          i === idx
                                            ? {
                                                ...s,
                                                timeSlots: s.timeSlots.filter(
                                                  (_, j) => j !== tsIdx
                                                ),
                                              }
                                            : s
                                        )
                                        .filter((s) => s.timeSlots.length > 0)
                                    );
                                  }}
                                >
                                  <DeleteOutline />
                                </IconButton>
                              </Box>
                            ))}
                            <Button
                              size="small"
                              startIcon={<AddIcon />}
                              onClick={() => {
                                setScheduleSlots((prev) =>
                                  prev.map((s, i) =>
                                    i === idx
                                      ? {
                                          ...s,
                                          timeSlots: [
                                            ...s.timeSlots,
                                            {
                                              start: "",
                                              end: "",
                                              type: "Employment",
                                              note: "",
                                            },
                                          ],
                                        }
                                      : s
                                  )
                                );
                              }}
                            >
                              {t("employees.timing.addSlot", "Add Time Slot")}
                            </Button>
                          </Stack>
                        </Box>
                      ))}

                      <Button
                        startIcon={<AddIcon />}
                        onClick={() => {
                          const newSlot: ScheduleSlot = {
                            day: Array.from(selectedDays)[0] as any,
                            timeSlots: [
                              {
                                start: "",
                                end: "",
                                type: "Employment",
                                note: "",
                              },
                            ],
                          };
                          setScheduleSlots((prev) => [...prev, newSlot]);
                        }}
                        sx={{ mt: 1 }}
                      >
                        {t("employees.timing.addSchedule", "Add Schedule Slot")}
                      </Button>
                    </Box>
                  )}

                  <Box sx={{ mt: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={!!form.STATE}
                          onChange={(_, v) => setField("STATE", v)}
                        />
                      }
                      label={t("employees.fields.STATE", "Active")}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={!!form.FINGERPRINT_NEEDED}
                          onChange={(_, v) => setField("FINGERPRINT_NEEDED", v)}
                        />
                      }
                      label={t(
                        "employees.fields.FINGERPRINT_NEEDED",
                        "Fingerprint Required"
                      )}
                    />
                  </Box>
                </SquareCard>
              </SquareGrid>
            </Stack>
          )}

          {/* STEP 3: Other Information */}
          {step === 3 && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <SquareGrid>
                <SquareCard
                  title={t(
                    "employees.sections.preferences",
                    "Preferences & Uniform"
                  )}
                >
                  <SelectFixedWidth
                    label={t(
                      "employees.fields.PREFERRED_LANG",
                      "Preferred Lang"
                    )}
                    value={form.PREFERRED_LANG || ""}
                    onChange={(v) => setField("PREFERRED_LANG", v)}
                    w={200}
                  >
                    <MenuItem value="ar">Arabic</MenuItem>
                    <MenuItem value="en">English</MenuItem>
                    <MenuItem value="fr">French</MenuItem>
                  </SelectFixedWidth>
                  <TextFixedWidth
                    label={t("employees.fields.OUTFIT_NUM", "Outfit #")}
                    value={form.OUTFIT_NUM || ""}
                    onChange={(v) => setField("OUTFIT_NUM", v)}
                    w={200}
                  />
                  <TextFixedWidth
                    label={t("employees.fields.FOOTWEAR_NUM", "Footwear #")}
                    value={form.FOOTWEAR_NUM || ""}
                    onChange={(v) => setField("FOOTWEAR_NUM", v)}
                    w={200}
                  />
                </SquareCard>

                <SquareCard
                  title={t(
                    "employees.sections.objectives",
                    "Job Aim & Description"
                  )}
                  minH={220}
                >
                  <TextField
                    label={t(
                      "employees.fields.REQUEST_DEGREE",
                      "Requested Degree"
                    )}
                    value={form.REQUEST_DEGREE || ""}
                    onChange={(e) => setField("REQUEST_DEGREE", e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 200 }}
                  />
                  <TextField
                    multiline
                    minRows={3}
                    label={t("employees.fields.JOB_AIM", "Job Aim")}
                    value={form.JOB_AIM || ""}
                    onChange={(e) => setField("JOB_AIM", e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: "100%" }}
                  />
                  <TextField
                    multiline
                    minRows={3}
                    label={t(
                      "employees.fields.JOB_DESCRIPTION",
                      "Job Description"
                    )}
                    value={form.JOB_DESCRIPTION || ""}
                    onChange={(e) =>
                      setField("JOB_DESCRIPTION", e.target.value)
                    }
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: "100%" }}
                  />
                </SquareCard>

                <SquareCard
                  title={t("employees.sections.contractMeta", "Contract Meta")}
                >
                  <TextField
                    label={t(
                      "employees.fields.RENEWABLE_CONTRACT",
                      "Renewable Contract"
                    )}
                    value={form.RENEWABLE_CONTRACT || ""}
                    onChange={(e) =>
                      setField("RENEWABLE_CONTRACT", e.target.value)
                    }
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 200 }}
                    helperText={t(
                      "hr.hints.contractNote",
                      "e.g., 1 year renewable"
                    )}
                  />
                  <TextField
                    label={t(
                      "employees.fields.ATTACHED_NUMBER",
                      "Attached Ref"
                    )}
                    value={form.ATTACHED_NUMBER || ""}
                    onChange={(e) =>
                      setField("ATTACHED_NUMBER", e.target.value)
                    }
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 200 }}
                  />
                </SquareCard>

                {/* Leave the 4th square for future add-ons or notes */}
                <SquareCard
                  title={t("employees.sections.notes", "Notes")}
                  minH={220}
                >
                  <TextField
                    multiline
                    minRows={5}
                    label={t("employees.fields.COMMENT", "Comments")}
                    value={form.COMMENT || ""}
                    onChange={(e) => setField("COMMENT", e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: "100%" }}
                  />
                </SquareCard>
              </SquareGrid>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Button onClick={handlePreviousStep} disabled={step === 0}>
            {t("common.previous", "Previous")}
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={handleNextStep} variant="contained">
              {t("common.next", "Next")}
            </Button>
          ) : (
            <Button onClick={handleSubmit} variant="contained">
              {t("common.save", "Save")}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Schedule Edit Dialog */}
      <ScheduleDialog
        open={schedOpen}
        name={schedEmpName}
        start={schedStart}
        end={schedEnd}
        saving={schedSaving}
        error={schedError}
        onClose={() => setSchedOpen(false)}
        onChange={({ start, end }) => { setSchedStart(start); setSchedEnd(end); }}
        onSave={async () => {
          try {
            setSchedSaving(true);
            setSchedError(null);
            if (schedEmpId) {
              await updateEmployeeTimes(schedEmpId, { T_START: schedStart, T_END: schedEnd });
            }
            setSchedOpen(false);
          } catch (e: any) {
            setSchedError(String(e?.message || 'Failed to save times'));
          } finally {
            setSchedSaving(false);
          }
        }}
      />

      {/* Manage Attendance Profiles Dialog */}
      <Dialog open={attMgrOpen} onClose={()=> setAttMgrOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('hr.attendance.manageProfiles','Manage Attendance Profiles')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Existing profiles list */}
            <Paper variant="outlined" sx={{ p: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{t('common.existing','Existing')}</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {attendanceProfiles.length === 0 && (
                  <Typography variant="body2" color="text.secondary">{t('common.none','None')}</Typography>
                )}
                {attendanceProfiles.map(p => (
                  <Button key={p.name} size="small" variant={attMgrDraft.name===p.name? 'contained':'outlined'} onClick={()=> setAttMgrDraft({ ...p })}>
                    {p.name}
                  </Button>
                ))}
              </Box>
            </Paper>

            {/* Editor */}
            <TextField
              label={t('common.name','Name')}
              value={attMgrDraft.name}
              onChange={(e)=> setAttMgrDraft(s=>({ ...s, name: e.target.value }))}
              fullWidth
            />
            <FormLabel>{t('hr.attendance.days','Days')}</FormLabel>
            <FormGroup row>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                <FormControlLabel
                  key={d}
                  control={<Checkbox checked={attMgrDraft.days.includes(d)} onChange={()=> setAttMgrDraft(s=>({ ...s, days: s.days.includes(d) ? s.days.filter(x=>x!==d) : [...s.days, d] }))} />}
                  label={d}
                />
              ))}
            </FormGroup>
            <Box sx={{ display:'flex', gap:2 }}>
              <TextField label={t('hr.attendance.start','Start')} type="time" value={attMgrDraft.start} onChange={(e)=> setAttMgrDraft(s=>({ ...s, start: e.target.value }))} inputProps={{ step: 60 }} />
              <TextField label={t('hr.attendance.end','End')} type="time" value={attMgrDraft.end} onChange={(e)=> setAttMgrDraft(s=>({ ...s, end: e.target.value }))} inputProps={{ step: 60 }} />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=> setAttMgrDraft({ name: '', days: ['Mon','Tue','Wed','Thu','Fri'], start: '09:00', end: '17:00' })}>{t('common.new','New')}</Button>
          <Button color="error" onClick={()=> {
            if (!attMgrDraft.name) return;
            setAttendanceProfiles(prev => prev.filter(p=> p.name !== attMgrDraft.name));
            setAttMgrDraft({ name: '', days: ['Mon','Tue','Wed','Thu','Fri'], start: '09:00', end: '17:00' });
          }}>{t('common.delete','Delete')}</Button>
          <Button variant="contained" onClick={()=> {
            if (!attMgrDraft.name) return;
            setAttendanceProfiles(prev => {
              const i = prev.findIndex(p=> p.name === attMgrDraft.name);
              const next = [...prev];
              if (i>=0) next[i] = { ...attMgrDraft };
              else next.push({ ...attMgrDraft });
              return next;
            });
            setAttMgrOpen(false);
          }}>{t('common.save','Save')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={jobDialogOpen}
        onClose={() => setJobDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("hr.jobs.create", "Create New Position")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              required
              label={t("hr.jobs.fields.title", "Job Title")}
              placeholder={t("hr.jobs.placeholders.title", "مسمى الوظيفة")}
              value={jobForm.Job_title || ""}
              onChange={(e) =>
                setJobForm((prev) => ({ ...prev, Job_title: e.target.value }))
              }
            />
            <TextField
              fullWidth
              required
              label={t("hr.jobs.fields.name", "Job Name")}
              placeholder={t("hr.jobs.placeholders.name", "اسم الوظيفة")}
              value={jobForm.job_name || ""}
              onChange={(e) =>
                setJobForm((prev) => ({ ...prev, job_name: e.target.value }))
              }
            />
            <TextField
              fullWidth
              label={t("hr.jobs.fields.code", "Job Code")}
              placeholder={t("hr.jobs.placeholders.code", "رمز الوظيفة")}
              value={jobForm.Job_code || ""}
              onChange={(e) =>
                setJobForm((prev) => ({ ...prev, Job_code: e.target.value }))
              }
            />
            <TextField
              fullWidth
              label={t("hr.jobs.fields.level", "Level")}
              placeholder={t("hr.jobs.placeholders.level", "المستوى الوظيفي")}
              value={jobForm.Job_level || ""}
              onChange={(e) =>
                setJobForm((prev) => ({ ...prev, Job_level: e.target.value }))
              }
            />
            <TextField
              fullWidth
              type="number"
              label={t("hr.jobs.fields.degree", "Degree")}
              value={jobForm.Job_degree || 1}
              onChange={(e) =>
                setJobForm((prev) => ({
                  ...prev,
                  Job_degree: Number(e.target.value),
                }))
              }
            />
            <FormControl fullWidth>
              <InputLabel>
                {t("hr.jobs.fields.category", "Category")}
              </InputLabel>
              <Select
                value={jobForm.job_categories || ""}
                onChange={(e) =>
                  setJobForm((prev) => ({
                    ...prev,
                    job_categories: e.target.value,
                  }))
                }
              >
                {departments.map((dep) => (
                  <MenuItem key={dep} value={dep}>
                    {dep}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJobDialogOpen(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={handleSaveJob} variant="contained">
            {t("common.save", "Save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        message={snackbar.message}
      />
      <ScheduleDialog
        open={schedOpen}
        name={schedEmpName}
        start={schedStart}
        end={schedEnd}
        saving={schedSaving}
        error={schedError}
        onClose={closeSched}
        onChange={({ start, end }) => {
          setSchedStart(start);
          setSchedEnd(end);
        }}
        onSave={saveSched}
      />
    </Box>
  );
};

export default Employees;
