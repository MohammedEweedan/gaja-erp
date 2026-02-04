// --- Core deps ---
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");

// --- DB ---
const connect = require("./config/database");

// --- Models / routers / helpers from file #1 ---
const OriginalAchat = require("./models/Purchase/GoldOriginalAchat");
const images = require("./images");

// --- Extra deps from file #2 ---
const axios = require("axios");
const authenticateToken = require("./middleware/auth"); // kept as-is (even if unused in this file)

// IMPORTANT: file #1 used axiosHttp but did not define/import it.
// To keep functionality without changing route behavior, we alias it safely:
const axiosHttp = axios;

// --- Upload modules ---
const uploadWatchPic = require("./uploadWatchPic");
const uploadDiamondFiles = require("./uploadDiamondFiles");

// --- Routes from file #1 ---
const router = require("./routes/LoginRoute/userRoutes");
const prouter = require("./routes/SetupRoutes/positionsRoutes");
const crouter = require("./routes/SetupRoutes/customersRoutes");
const suppliersrouter = require("./routes/SetupRoutes/suppliersRoutes");
const itemstypes = require("./routes/SetupRoutes/itemsTypesRoutes");
const ps = require("./routes/SetupRoutes/psRoutes");
const products = require("./routes/SetupRoutes/productsTypesRoutes");
const boxes = require("./routes/SetupRoutes/boxesRoutes");
const sm = require("./routes/SetupRoutes/SourceMarkRoutes");
const purchase = require("./routes/PurchaseRoute/PRoute");
const invoices = require("./routes/PurchaseRoute/IRoute");
const Inventory = require("./routes/PurchaseRoute/InventoryRoute");
const Revenue = require("./routes/FinanceRoute/RevenueRoute");
const Expense = require("./routes/FinanceRoute/ExpensesRoute");
const Accounts = require("./routes/FinanceRoute/COARoute");
const GLs = require("./routes/FinanceRoute/GLRoute");
const Opurchase = require("./routes/PurchaseRoute/originalAchat/OPRoute");
const DOpurchase = require("./routes/PurchaseRoute/originalAchat/DPRoute");
const WOpurchase = require("./routes/PurchaseRoute/originalAchat/WPRoute");
const Vendors = require("./routes/SetupRoutes/vendorsRoutes");
const Dpurchase = require("./routes/PurchaseRoute/DPRoute");
const Suppliersettlement = require("./routes/FinanceRoute/Supplier_settlementRoute");
const PicRoute = require("./routes/SetupRoutes/ItemPictureRoutes");
const ApprovalRequests = require("./routes/ApprovalRequestsRoute");
// const ShareRoutes = require("./routes/ShareRoutes");
// const NotificationRoutes = require("./routes/NotificationRoute");
const employees = require("./routes/SetupRoutes/employeeRoutes");
const users = require("./routes/LoginRoute/userRoutes");
// const RateTbRoute = require("./routes/RateTbRoute");
// const LogRoute = require("./routes/LogRoute");
// const RolesTBRoute = require("./routes/RolesTBRoute");
// const LogTransferRoute = require("./routes/LogTransferRoute");
// const PushTokensRoute = require("./routes/PushTokensRoute");

// --- Routes from file #2 (HR) ---
const leaveRoutes = require("./routes/hr/leaveRoutes");
const jobRoutes = require("./routes/hr/jobRoutes");
const specialiteRoutes = require("./routes/hr/specialiteRoutes");
const contractTypeRoutes = require("./routes/hr/contractTypeRoutes");
const catalogRoutes = require("./routes/hr/catalogRoutes");
const codeRoutes = require("./routes/hr/codeRoutes");
const holidaysRoutes = require("./routes/hr/holidayRoutes");
const attendanceRoutes = require("./routes/hr/attendanceRoutes");
const timesheetRoutes = require("./routes/hr/timesheetRoutes");
const payrollRoutes = require("./routes/hr/payrollRoutes");
const payrollV2Routes = require("./routes/hr/payrollV2Routes");
const payrollController = require("./controllers/HR/payrollController");
const tsCodeRoutes = require("./routes/hr/tsCodeRoutes");
const Employee = require("./models/hr/employee1");

// --- Init app ---
const app = express();

// --- SlowBuffer patch (from file #2) ---
const buffer = require("buffer");
if (!buffer.SlowBuffer) buffer.SlowBuffer = buffer.Buffer;
if (!global.SlowBuffer) global.SlowBuffer = buffer.Buffer;

// --- Connect DB ---
connect();

// --- Ensure upload folders exist (both files) ---
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const purchaseUploadDir = path.join(__dirname, "uploads", "purchase");
if (!fs.existsSync(purchaseUploadDir)) {
  fs.mkdirSync(purchaseUploadDir, { recursive: true });
}

// --- Load env ---
require("dotenv").config();

// --- Register upload modules on app (both files) ---
require("./uploadWatchPic")(app);
require("./uploadDiamondFiles")(app);

// ---------------- CORS (merged origins from BOTH files) ----------------
const allowedOrigins = [
  // file #1 (kept)
  "http://localhost:3000",
  "http://localhost:8000",
  "http://localhost:9000/api",
  "http://localhost:9000/api:8000",

  // file #2 (kept)
  "http://102.213.182.8:3000",
  "http://102.213.182.8:8000",
  "http://127.0.0.1:3000",
  "http://192.168.3.46:3000",
  "http://0.0.0.0:3000",
  "http://localhost:5173",
  "http://localhost:11434",
  "http://localhost",
];

// CORS MUST be before routes/static
app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests without origin (Postman / server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    // merged: include PATCH + HEAD
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    // merged headers
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Employee"],
  })
);

// Ensure CORS preflight succeeds (from file #2)
app.options("*", cors());

// ---------------- Body parsers (keep LARGE limit from file #1) ----------------
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// ---------------- /api prefix compatibility rewrite (from file #1) ----------------
// IMPORTANT: file #2 contains REAL /api routes (CRM).
// Your pasted file #2 mounts those BEFORE the rewrite.
// Since we didn't paste those CRM routes here (they weren't in file #1),
// we keep rewrite AS-IS to preserve file #1 functionality exactly.
app.use((req, res, next) => {
  try {
    if (req.path && req.path.startsWith("/api/")) {
      req.url = req.url.replace(/^\/api/, "");
    }
  } catch (e) {
    console.warn("API-prefix rewrite error:", e && e.message ? e.message : e);
  }
  next();
});

// ---------------- Idempotency guards (from file #2, kept as-is) ----------------
const transientWindowMs = 60_000; // handles React StrictMode / double-submits
const transientCache = new Map(); // key -> timestamp
const strongCache = new Map(); // idempotency-key -> timestamp (24h)
const strongTtlMs = 24 * 60 * 60 * 1000;

function makeDelegateKey(body = {}) {
  const { id_emp, date_start, date_end, delegate_id } = body;
  return `delegate:${id_emp}:${date_start}:${date_end}:${delegate_id || ""}`;
}
function isTransientDuplicate(key) {
  const now = Date.now();
  const ts = transientCache.get(key);
  if (ts && now - ts < transientWindowMs) return true;
  transientCache.set(key, now);
  for (const [k, t] of transientCache) if (now - t > transientWindowMs) transientCache.delete(k);
  return false;
}
function isStrongDuplicate(req) {
  const key = req.get("Idempotency-Key");
  if (!key) return false;
  const now = Date.now();
  const ts = strongCache.get(key);
  if (ts && now - ts < strongTtlMs) return true;
  strongCache.set(key, now);
  for (const [k, t] of strongCache) if (now - t > strongTtlMs) strongCache.delete(k);
  return false;
}

// ---------------- Mail & date utils (from file #2) ----------------
function createTransporter() {
  return nodemailer.createTransport({
    host: "mail.gaja.ly",
    port: 587,
    secure: false,
    auth: {
      user: "info@gaja.ly",
      pass: "P@$$word123",
    },
    tls: { rejectUnauthorized: false },
  });
}

function fmtISO(d) {
  if (!d) return "";
  const x = new Date(d);
  if (isNaN(x)) return String(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const da = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

// ---------- Payslip email helpers (from file #2) ----------
function decodePdfBase64(pdfBase64) {
  const b64 = String(pdfBase64).includes(",")
    ? String(pdfBase64).split(",")[1]
    : String(pdfBase64);
  return Buffer.from(b64, "base64");
}

async function sendPayslipEmailHandler(req, res) {
  try {
    console.log("[sendPayslip] HIT", {
      keys: Object.keys(req.body || {}),
      pdfBase64Len: (req.body?.pdfBase64 || "").length,
      to: req.body?.to,
      employeeId: req.body?.employeeId,
      year: req.body?.year,
      month: req.body?.month,
    });

    let { pdfBase64, filename, to, subject, html, employeeId, year, month } = req.body || {};

    let content;
    let usedClientPdf = false;

    if (pdfBase64) {
      console.log("[sendPayslip] Using CLIENT PDF");
      content = decodePdfBase64(pdfBase64);
      usedClientPdf = true;
    } else if (employeeId && year && month) {
      console.warn("[sendPayslip] No pdfBase64 provided, falling back to server-generated PDF");
      const { slip, period, emp } =
        await payrollController.getPayslipData(Number(employeeId), year, month);

      content = await payrollController.makePayslipPdfBuffer({ slip, period });

      if (!to && emp && emp.EMAIL) {
        to = emp.EMAIL;
      }
      if (!subject) {
        subject = `Payslip — ${period.start} → ${period.end}`;
      }
      if (!html) {
        html = `<p>Your payslip for <strong>${period.start}</strong> to <strong>${period.end}</strong> is attached.</p>`;
      }
      if (!filename) {
        filename = `payslip_${slip.id_emp}_${slip.year}_${slip.month}.pdf`;
      }
    } else {
      console.error("[sendPayslip] Missing pdfBase64 and also missing employeeId/year/month");
      return res.status(400).json({
        ok: false,
        message: "You must send either pdfBase64 OR employeeId + year + month in the body.",
      });
    }

    if (!to && employeeId) {
      try {
        const empRow = await Employee.findByPk(Number(employeeId), {
          attributes: ["EMAIL"],
          raw: true,
        });
        if (empRow && empRow.EMAIL) {
          to = empRow.EMAIL;
          console.log("[sendPayslip] using employee email:", empRow.EMAIL);
        }
      } catch (e) {
        console.warn("[sendPayslip] employee lookup failed", e?.message || e);
      }
    }

    const mailTo = to || "hr@gaja.ly";

    const subj =
      subject ||
      (year && month
        ? `Payslip — ${year}-${String(month).padStart(2, "0")}`
        : "Payslip");

    const bodyHtml = html || "<p>Your payslip is attached.</p>";

    const attachName =
      filename || `payslip_${employeeId || "emp"}_${year || ""}_${month || ""}.pdf`;

    const transporter = createTransporter();

    const info = await transporter.sendMail({
      from: '"Gaja System" <hr@gaja.ly>',
      to: mailTo,
      subject: subj,
      html: bodyHtml,
      attachments: [{ filename: attachName, content }],
    });

    console.log("[sendPayslip] Email sent", {
      messageId: info?.messageId,
      envelope: info?.envelope,
      to: mailTo,
      usedClientPdf,
    });

    res.json({ ok: true, sentTo: mailTo, usedClientPdf, messageId: info?.messageId || null });
  } catch (e) {
    console.error("sendPayslipEmailHandler error:", e);
    res.status(500).json({ ok: false, message: "Failed to send payslip", error: e?.message || String(e) });
  }
}

// Both routes MUST point here (from file #2)
app.post("/hr/payroll/send-payslip-client", sendPayslipEmailHandler);
app.post("/hr/payroll/send-payslip", sendPayslipEmailHandler);

// ---------- Leave / accrual helpers (from file #2) ----------
function daysBetweenInclusive(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  if (isNaN(d1) || isNaN(d2)) return 0;
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const ms = d2.getTime() - d1.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

function nextWorkday(fromDate, holidaysSet = new Set()) {
  if (!fromDate) return null;
  let d = new Date(fromDate);
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  while (true) {
    const isFriday = d.getDay() === 5;
    const iso = fmtISO(d);
    const isHoliday = holidaysSet.has(iso);
    if (!isFriday && !isHoliday) return d;
    d.setDate(d.getDate() + 1);
  }
}

function countEffectiveDays(start, end, holidaysSet = new Set()) {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s) || isNaN(e)) return 0;
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  let c = 0;
  const d = new Date(s);
  while (d <= e) {
    const isFriday = d.getDay() === 5;
    const iso = fmtISO(d);
    const isHoliday = holidaysSet.has(iso);
    if (!isFriday && !isHoliday) c++;
    d.setDate(d.getDate() + 1);
  }
  return c;
}

function isApprovedLike(status) {
  const s = String(status || "").trim().toLowerCase();
  if (!s) return false;
  const tokens = [
    "approved",
    "accepted",
    "validated",
    "approuved",
    "approuvé",
    "validé",
    "approved by hr",
    "approved_by_hr",
  ];
  return tokens.some((tk) => s.includes(tk));
}

function computeAccruedDays({ dob, contractStart }, now = new Date()) {
  if (!contractStart) return 0;

  const RATE30 = 30 / 365;
  const RATE45 = 45 / 365;

  const parseDate = (v) => (v ? new Date(v) : null);
  const cs = parseDate(contractStart);
  if (!cs || isNaN(cs)) return 0;

  const addYears = (d, years) => new Date(d.getFullYear() + years, d.getMonth(), d.getDate());
  const turns50On = dob ? addYears(new Date(dob), 50) : null;
  const exp20On = addYears(cs, 20);

  const age = dob ? Math.floor((now - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
  const expYears = Math.floor((now - cs) / (365.25 * 24 * 60 * 60 * 1000));
  const senior = age >= 50 || expYears >= 20;

  const thisYearAnniv = new Date(now.getFullYear(), cs.getMonth(), cs.getDate());
  const periodStart =
    thisYearAnniv <= now
      ? thisYearAnniv
      : new Date(now.getFullYear() - 1, cs.getMonth(), cs.getDate());
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const thresholds = [turns50On, exp20On].filter(Boolean).sort((a, b) => a - b);
  const threshold = thresholds.length ? thresholds[0] : null;

  let total = 0;
  if (!threshold) {
    total = daysBetweenInclusive(periodStart, periodEnd) * (senior ? RATE45 : RATE30);
  } else if (threshold <= periodStart) {
    total = daysBetweenInclusive(periodStart, periodEnd) * RATE45;
  } else if (threshold > periodEnd) {
    total = daysBetweenInclusive(periodStart, periodEnd) * RATE30;
  } else {
    const dayBeforeThreshold = new Date(threshold.getTime() - 24 * 60 * 60 * 1000);
    total += daysBetweenInclusive(periodStart, dayBeforeThreshold) * RATE30;
    total += daysBetweenInclusive(threshold, periodEnd) * RATE45;
  }

  return Number(total.toFixed(2));
}

function computeEntitlement({ dob, contractStart }, now = new Date()) {
  const age = dob ? Math.floor((now - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
  const cs = contractStart ? new Date(contractStart) : null;
  const expYears = cs ? Math.floor((now - cs) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
  return age >= 50 || expYears >= 20 ? 45 : 30;
}

// ---------------- Multer storage for user-pic (file #1 + #2 identical logic) ----------------
const userPicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id_employee = req.body.id_employee || req.query.id_employee;
    const userPicPath = path.join(__dirname, "uploads", "user-pic", String(id_employee));
    if (!fs.existsSync(userPicPath)) {
      fs.mkdirSync(userPicPath, { recursive: true });
    }
    cb(null, userPicPath);
  },
  filename: (req, file, cb) => {
    cb(null, "profile.jpg");
  },
});
const userPicUpload = multer({ storage: userPicStorage });

app.use((req, res, next) => {
  try {
    const ou = req.originalUrl || "";
    if (
      ou.startsWith("/api/appointments") ||
      ou.startsWith("/api/support/tickets") ||
      ou.startsWith("/api/schedule") ||
      ou.startsWith("/api/items") ||
      ou.startsWith("/api/analytics")
    ) {
      req.url = ou; // restore original so CRM routes work "as-is"
    }
  } catch {}
  next();
});

// ---------------- Bot gateway & CRM routes (as in file #2) ----------------
try {
  const botApp = require("./bot");
  app.use("/bot", botApp);
} catch {}
try {
  const crmAppointmentsRoutes = require("./routes/CRM/appointmentsRoutes");
  app.use("/api/appointments", crmAppointmentsRoutes);
} catch {}
try {
  const crmTicketsRoutes = require("./routes/CRM/ticketsRoutes");
  app.use("/api/support/tickets", crmTicketsRoutes);
} catch {}
try {
  const scheduleRoutes = require("./routes/CRM/scheduleRoutes");
  app.use("/api/schedule", scheduleRoutes);
} catch {}
try {
  const itemsRoutes = require("./routes/CRM/itemsRoutes");
  app.use("/api/items", itemsRoutes);
} catch {}
try {
  const analyticsRoutes = require("./routes/CRM/analyticsRoutes");
  app.use("/api/analytics", analyticsRoutes);
} catch {}

// ---------------- Routes mounting (merged: BOTH files, all kept) ----------------
app.use("/employees", employees);
app.use("/positions", prouter);
app.use("/customers", crouter);
app.use("/suppliers", suppliersrouter);
app.use("/itemstypes", itemstypes);
app.use("/ps", ps);
app.use("/products", products);
app.use("/boxes", boxes);
app.use("/sm", sm);

app.use("/purchases", purchase);
app.use("/Dpurchases", Dpurchase);
app.use("/Opurchases", Opurchase);
app.use("/DOpurchases", DOpurchase);
app.use("/WOpurchases", WOpurchase);

app.use("/invoices", invoices);
app.use("/Inventory", Inventory);

app.use("/Revenue", Revenue);
app.use("/Expense", Expense);
app.use("/Accounts", Accounts);
app.use("/GLs", GLs);

app.use("/users", users);
app.use("/vendors", Vendors);
app.use("/GetPICs", PicRoute);
app.use("/Suppliersettlement", Suppliersettlement);
app.use("/images", images);
app.use("/ApprovalRequests", ApprovalRequests);

// file #1 unique mounts
// app.use("/", PushTokensRoute);
// app.use("/rate-tb", RateTbRoute);
// app.use("/roles", RolesTBRoute);
// app.use("/taking_images", LogRoute);
// app.use("/notification", NotificationRoutes);
// app.use("/Share", ShareRoutes);
// app.use("/log-transfer", LogTransferRoute);

// file #2 HR mounts
app.use("/leave", leaveRoutes);
app.use("/jobs", jobRoutes);
app.use("/specialites", specialiteRoutes);
app.use("/contract-types", contractTypeRoutes);
app.use("/catalog", catalogRoutes);
app.use("/holiday", holidaysRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/hr", codeRoutes);
app.use("/hr", timesheetRoutes);
app.use("/hr", payrollRoutes);
app.use("/hr", payrollV2Routes);
app.use("/hr", tsCodeRoutes);

// IMPORTANT: keep router mount (both files) — mount LAST to avoid overriding
app.use("/", router);

// ---------------- Upload: profile picture (as-is) ----------------
app.post("/employees/upload-profile-pic", userPicUpload.single("profile_pic"), (req, res) => {
  const id_employee = req.body.id_employee || req.query.id_employee;
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const fileUrl = `/uploads/user-pic/${id_employee}/profile.jpg`;
  res.json({ imageUrl: fileUrl, fileUrl });
});

// ---------------- Static files (as-is from file #1 + #2) ----------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads/user-pic", express.static(path.join(__dirname, "uploads", "user-pic")));
app.use("/uploads/purchase", express.static(path.join(__dirname, "uploads", "purchase")));
app.use("/uploads/WOpurchase", express.static(path.join(__dirname, "uploads", "WOpurchase")));
app.use("/uploads/DOpurchase", express.static(path.join(__dirname, "uploads", "DOpurchase")));

// ---------------- Generic file uploads (as-is) ----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

app.post("/upload", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ link: fileUrl });
});

// ---------------- Purchase attachments (Gold) (as-is) ----------------
const purchaseStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let id_achat = req.body.id_achat || req.query.id_achat;
    if (!id_achat) {
      return cb(null, "uploads/purchase/_unknown/");
    }
    const dir = path.join(__dirname, "uploads", "purchase", String(id_achat));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});
const purchaseUpload = multer({ storage: purchaseStorage });

app.post("/Opurchases/upload-attachment", purchaseUpload.array("files", 10), async (req, res) => {
  const { id_achat } = req.body;
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }
  if (!id_achat) {
    return res.status(400).json({ error: "No purchase ID provided" });
  }

  const fileUrls = req.files.map(
    (file) => `${req.protocol}://${req.get("host")}/uploads/purchase/${id_achat}/${file.filename}`
  );

  try {
    await OriginalAchat.update({ attachmentUrl: JSON.stringify(fileUrls) }, { where: { id_achat } });
    res.json({ links: fileUrls });
  } catch (err) {
    res.status(500).json({ error: "Failed to update purchase with attachments" });
  }
});

// ---------------- Diamond attachments (as-is) ----------------
const diamondPurchaseStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/purchase/");
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});
const diamondPurchaseUpload = multer({ storage: diamondPurchaseStorage });

app.post("/DOpurchases/upload-attachment", diamondPurchaseUpload.single("file"), async (req, res) => {
  const { id_achat } = req.body;
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  if (!id_achat) {
    return res.status(400).json({ error: "No purchase ID provided" });
  }

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/purchase/${req.file.filename}`;

  try {
    const OriginalAchat = require("./models/Purchase/DiamonOriginalAchat");
    await OriginalAchat.update({ attachmentUrl: fileUrl }, { where: { id_achat } });
    res.json({ link: fileUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to update diamond purchase with attachment" });
  }
});

// ---------------- Approval Emails (Gold, Diamond, Watch) (as-is) ----------------
app.post("/Opurchases/send-approval", async (req, res) => {
  const { id_achat, email, purchaseInfo } = req.body;
  if (!id_achat || !email) {
    return res.status(400).json({ message: "Missing id_achat or email" });
  }
  try {
    const achat = await OriginalAchat.findByPk(id_achat);
    if (!achat || !achat.attachmentUrl) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    let htmlBody = `<h2>Purchase Approval Needed</h2>
    <p>Please review the following purchase details:</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;">
      <tr><th align="left">Note</th><td>${purchaseInfo?.Comment_Achat || ""}</td></tr>
      <tr><th align="left">Date</th><td>${purchaseInfo?.Date_Achat || ""}</td></tr>
      <tr><th align="left">Full Weight</th><td>${purchaseInfo?.FullWeight || ""}</td></tr>
      <tr><th align="left">Net Weight</th><td>${purchaseInfo?.NetWeight || ""}</td></tr>
      <tr><th align="left">Brand</th><td>${purchaseInfo?.Supplier || ""}</td></tr>
      <tr><th align="left">Document No</th><td>${purchaseInfo?.DocumentNo || ""}</td></tr>
      <tr><th align="left">Stone Details</th><td>${purchaseInfo?.Stone_Details || ""}</td></tr>
      <tr><th align="left">Net Details</th><td>${purchaseInfo?.Net_Details || ""}</td></tr>
      <tr><th align="left">Purity</th><td>${purchaseInfo?.Purity || ""}</td></tr>
      <tr><th align="left">Pure Wt</th><td>${purchaseInfo?.PureWt || ""}</td></tr>
      <tr><th align="left">Making Stone Rate</th><td>${purchaseInfo?.MakingStoneRate || ""}</td></tr>
      <tr><th align="left">Making Stone Value</th><td>${purchaseInfo?.MakingStoneValue || ""}</td></tr>
      <tr><th align="left">Metal Value</th><td>${purchaseInfo?.MetalValue || ""}</td></tr>
    </table>
    <p>See the attached file for more details.</p>
    <p>pls Login to system and your action.</p>`;

    const transporter = createTransporter();

    await transporter.sendMail({
      from: '"Gaja System" <hr@gaja.ly>',
      to: email,
      subject: "Purchase Approval Needed",
      html: htmlBody,
      attachments: [
        {
          filename: achat.attachmentUrl.split("/").pop(),
          path: achat.attachmentUrl,
        },
      ],
    });

    res.json({ message: "Approval email sent!" });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ message: "Failed to send email", error: err.message });
  }
});

app.post("/DOpurchases/send-approval", async (req, res) => {
  const { id_achat, email, purchaseInfo } = req.body;
  if (!id_achat || !email) {
    return res.status(400).json({ message: "Missing id_achat or email" });
  }
  try {
    const OriginalAchat = require("./models/Purchase/DiamonOriginalAchat");
    const achat = await OriginalAchat.findByPk(id_achat);
    if (!achat || !achat.attachmentUrl) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    let htmlBody = `<h2>Diamond Purchase Approval Needed</h2>
    <p>Please review the following diamond purchase details:</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;">
      <tr><th align="left">Comment</th><td>${purchaseInfo?.Comment_Achat || ""}</td></tr>
      <tr><th align="left">Date</th><td>${purchaseInfo?.Date_Achat || ""}</td></tr>
      <tr><th align="left">Carat</th><td>${purchaseInfo?.carat || ""}</td></tr>
      <tr><th align="left">Supplier</th><td>${purchaseInfo?.Supplier || ""}</td></tr>
      <tr><th align="left">Document No</th><td>${purchaseInfo?.DocumentNo || ""}</td></tr>
      <tr><th align="left">Certificate #</th><td>${purchaseInfo?.certificate_number || ""}</td></tr>
      <tr><th align="left">Certificate Lab</th><td>${purchaseInfo?.certificate_lab || ""}</td></tr>
      <tr><th align="left">Total Price</th><td>${purchaseInfo?.total_price || ""}</td></tr>
      <tr><th align="left">Price/Carat</th><td>${purchaseInfo?.price_per_carat || ""}</td></tr>
      <tr><th align="left">Shape</th><td>${purchaseInfo?.shape || ""}</td></tr>
      <tr><th align="left">Color</th><td>${purchaseInfo?.color || ""}</td></tr>
      <tr><th align="left">Clarity</th><td>${purchaseInfo?.clarity || ""}</td></tr>
      <tr><th align="left">Cut</th><td>${purchaseInfo?.cut || ""}</td></tr>
    </table>
    <p>See the attached file for more details.</p>
    <p>Please login to the system to take action.</p>`;

    const transporter = createTransporter();

    await transporter.sendMail({
      from: '"Gaja System" <hr@gaja.ly>',
      to: email,
      subject: "Diamond Purchase Approval Needed",
      html: htmlBody,
      attachments: [
        {
          filename: achat.attachmentUrl.split("/").pop(),
          path: achat.attachmentUrl,
        },
      ],
    });

    res.json({ message: "Approval email sent!" });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ message: "Failed to send email", error: err.message });
  }
});

app.post("/WOpurchases/send-approval", async (req, res) => {
  const { id_achat, email, purchaseInfo } = req.body;
  if (!id_achat || !email) {
    return res.status(400).json({ message: "Missing id_achat or email" });
  }
  try {
    const OriginalAchat = require("./models/Purchase/WachtchesOriginalAchat");
    const achat = await OriginalAchat.findByPk(id_achat);
    if (!achat || !achat.attachmentUrl) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    let htmlBody = `<h2>Watch Purchase Approval Needed</h2>
    <p>Please review the following watch purchase details:</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;">
      <tr><th align="left">Comment</th><td>${purchaseInfo?.Comment_Achat || ""}</td></tr>
      <tr><th align="left">Date</th><td>${purchaseInfo?.Date_Achat || ""}</td></tr>
      <tr><th align="left">Model</th><td>${purchaseInfo?.model || ""}</td></tr>
      <tr><th align="left">Supplier</th><td>${purchaseInfo?.Supplier || ""}</td></tr>
      <tr><th align="left">Document No</th><td>${purchaseInfo?.DocumentNo || ""}</td></tr>
      <tr><th align="left">Reference #</th><td>${purchaseInfo?.reference_number || ""}</td></tr>
      <tr><th align="left">Serial #</th><td>${purchaseInfo?.serial_number || ""}</td></tr>
      <tr><th align="left">Sale Price</th><td>${purchaseInfo?.sale_price || ""}</td></tr>
      <tr><th align="left">Retail Price</th><td>${purchaseInfo?.retail_price || ""}</td></tr>
      <tr><th align="left">Condition</th><td>${purchaseInfo?.condition || ""}</td></tr>
      <tr><th align="left">Diamond Carat</th><td>${purchaseInfo?.diamond_total_carat || ""}</td></tr>
      <tr><th align="left">Diamond Quality</th><td>${purchaseInfo?.diamond_quality || ""}</td></tr>
      <tr><th align="left">Box/Papers</th><td>${purchaseInfo?.box_papers ? "Yes" : "No"}</td></tr>
    </table>
    <p>See the attached file for more details.</p>
    <p>Please login to the system to take action.</p>`;

    const transporter = createTransporter();

    await transporter.sendMail({
      from: '"Gaja System" <hr@gaja.ly>',
      to: email,
      subject: "Watch Purchase Approval Needed",
      html: htmlBody,
      attachments: [
        {
          filename: achat.attachmentUrl.split("/").pop(),
          path: achat.attachmentUrl,
        },
      ],
    });

    res.json({ message: "Approval email sent!" });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ message: "Failed to send email", error: err.message });
  }
});

// ---------------- Enhanced delegation endpoint (as-is from file #2) ----------------
app.post("/holidays/send-delegate", async (req, res) => {
  try {
    if (isStrongDuplicate(req)) {
      return res.status(202).json({ message: "Duplicate request ignored (Idempotency-Key)" });
    }
    const transKey = makeDelegateKey(req.body || {});
    if (isTransientDuplicate(transKey)) {
      return res.status(202).json({ message: "Duplicate request ignored (transient window)" });
    }

    const {
      id_emp,
      date_start,
      date_end,
      comment,
      delegate_id,
      approver_email,
      holidays,
      leaveSummary,
      leaveHistory,
    } = req.body || {};

    if (!id_emp || !date_start || !date_end) {
      return res.status(400).json({ message: "Missing id_emp, date_start, or date_end" });
    }

    const requester = await Employee.findByPk(id_emp);
    if (!requester) return res.status(404).json({ message: "Requester not found" });

    let delegateIdRaw =
      delegate_id ?? (requester.JOB_RELATION ? String(requester.JOB_RELATION).trim() : null);

    if (!delegateIdRaw) {
      return res
        .status(404)
        .json({ message: "No delegate found via JOB_RELATION and no delegate_id provided" });
    }

    const tryNumeric = (val) => {
      const n = Number(val);
      return Number.isFinite(n) ? n : null;
    };

    let delegate = null;
    let delegateIdNum = tryNumeric(delegateIdRaw);
    if (!delegateIdNum && typeof delegateIdRaw === "string") {
      const match = delegateIdRaw.match(/\d+/);
      if (match) delegateIdNum = Number(match[0]);
    }
    if (delegateIdNum) {
      delegate = await Employee.findByPk(delegateIdNum).catch(() => null);
    }
    if (!delegate && typeof delegateIdRaw === "string") {
      delegate = await Employee.findOne({ where: { EMAIL: delegateIdRaw } }).catch(() => null);
    }
    if (!delegate && typeof delegateIdRaw === "string") {
      delegate = await Employee.findOne({ where: { NAME: delegateIdRaw } }).catch(() => null);
    }
    if (!delegate) {
      return res.status(404).json({ message: "Delegated employee not found", hint: String(delegateIdRaw) });
    }

    const holidaysSet = new Set(Array.isArray(holidays) ? holidays.map(fmtISO) : []);
    const periodStartISO = fmtISO(date_start);
    const periodEndISO = fmtISO(date_end);
    const returnToWork = nextWorkday(periodEndISO, holidaysSet);

    const now = new Date();
    const dob = requester?.DATE_OF_BIRTH || requester?.DOB || null;
    const contractStart = requester?.CONTRACT_START || requester?.T_START || null;

    const computedEntitlement = computeEntitlement({ dob, contractStart }, now);
    const accruedDays = computeAccruedDays({ dob, contractStart }, now);

    let usedApprovedDays = 0;
    if (Array.isArray(leaveHistory) && leaveHistory.length) {
      const year = now.getFullYear();
      usedApprovedDays = leaveHistory
        .filter((h) => {
          const st = h.startDate ? new Date(h.startDate) : null;
          const en = h.endDate ? new Date(h.endDate) : null;
          const inYear = (st && st.getFullYear() === year) || (en && en.getFullYear() === year);
          return inYear && isApprovedLike(String(h.status || ""));
        })
        .reduce((sum, h) => {
          const st = h.startDate ? new Date(h.startDate) : null;
          const en = h.endDate ? new Date(h.endDate) : null;
          if (!st || !en) return sum;
          return sum + countEffectiveDays(st, en, holidaysSet);
        }, 0);
    } else if (leaveSummary?.balance?.used != null) {
      usedApprovedDays = Number(leaveSummary.balance.used) || 0;
    }

    const effectiveDaysThisRequest = countEffectiveDays(periodStartISO, periodEndISO, holidaysSet);
    const remainingAfter = Math.max(
      0,
      Number((accruedDays - usedApprovedDays - effectiveDaysThisRequest).toFixed(2))
    );

    const summary = {
      entitlement: computedEntitlement,
      accruedDays,
      usedApprovedDays,
      effectiveDaysThisRequest,
      remainingAfter,
      reasoning: [
        "Accrual is prorated within the current working year (from last contract anniversary).",
        "30 days/year before threshold; 45 days/year starting the day the employee turns 50 or completes 20 years of service.",
        "Working-day deductions exclude Fridays and listed public holidays.",
        "Return-to-work is the first working day after the end date.",
      ],
      types: Array.isArray(leaveSummary?.types)
        ? leaveSummary.types
        : [{ code: "AL", name: "Annual Leave", days: effectiveDaysThisRequest }],
    };

    const windowText = `${periodStartISO} → ${periodEndISO}`;
    const approverTo = approver_email || "hr@gaja.ly";
    const transporter = createTransporter();

    try {
      await transporter.verify();
    } catch (e) {
      console.warn("[send-delegate] SMTP verify failed:", e?.message || e);
    }

    const approverHtml = `
      <h2>Leave Delegation Request</h2>
      <p><strong>Requester:</strong> ${requester.NAME || requester.ID_EMP}</p>
      <p><strong>Position:</strong> ${requester.TITLE || ""}</p>
      <p><strong>Delegated To:</strong> ${delegate.NAME || delegate.ID_EMP} (${delegate.EMAIL || "no email"})</p>
      <p><strong>Delegation Period:</strong> ${windowText}</p>
      ${comment ? `<p><strong>Reason:</strong> ${comment}</p>` : ""}
      <p>Please review and record this delegation for the specified period.</p>
    `;

    const delegateHtml = `
      <h2>You Have Been Delegated</h2>
      <p>Dear ${delegate.NAME || "Colleague"},</p>
      <p>${requester.NAME || "A manager"} has requested leave and delegated their duties to you for the following period:</p>
      <p><strong>${windowText}</strong></p>
      ${comment ? `<p><strong>Notes:</strong> ${comment}</p>` : ""}
      <p>Please get in touch with your manager to confirm this delegation.</p>
    `;

    const typeRows = (summary.types || [])
      .map(
        (t) =>
          `<tr><td>${t.code || ""}${t.name ? " — " + t.name : ""}</td><td style="text-align:right">${Number(
            t.days || 0
          )}</td></tr>`
      )
      .join("");

    const reasoningList = (summary.reasoning || []).map((r) => `<li>${String(r)}</li>`).join("");

    const requesterHtml = `
      <h2>Leave Approved — Summary</h2>
      <p>Dear ${requester.NAME || "Colleague"},</p>
      <p>Your leave has been approved for the period:</p>
      <p><strong>${windowText}</strong></p>

      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;min-width:560px">
        <tr><th align="left">Start date</th><td>${periodStartISO}</td></tr>
        <tr><th align="left">End date</th><td>${periodEndISO}</td></tr>
        <tr><th align="left">Effective days deducted</th><td>${summary.effectiveDaysThisRequest}</td></tr>
        <tr><th align="left">Return to work</th><td>${returnToWork ? fmtISO(returnToWork) : "—"}</td></tr>
      </table>

      <h3 style="margin-top:16px">Leave Type Breakdown</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;min-width:560px">
        <tr style="background:#f3f3f3"><th align="left">Type</th><th align="right">Days</th></tr>
        ${typeRows}
      </table>

      <h3 style="margin-top:16px">Balance</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;min-width:560px">
        <tr><th align="left">Yearly entitlement</th><td>${summary.entitlement}</td></tr>
        <tr><th align="left">Accrued this working year (to date)</th><td>${summary.accruedDays}</td></tr>
        <tr><th align="left">Used so far (approved)</th><td>${summary.usedApprovedDays}</td></tr>
        <tr><th align="left">Remaining after this leave</th><td>${summary.remainingAfter}</td></tr>
      </table>

      <h3 style="margin-top:16px">Reasoning</h3>
      <ul style="margin:8px 0 0 18px">
        ${reasoningList}
      </ul>

      ${comment ? `<p><strong>Notes:</strong> ${comment}</p>` : ""}

      <p style="margin-top:12px">If any detail looks incorrect, please contact HR.</p>
    `;

    try {
      const info1 = await transporter.sendMail({
        from: '"Gaja System" <hr@gaja.ly>',
        to: approverTo,
        subject: "Leave Delegation Request",
        html: approverHtml,
      });
      console.log("[send-delegate] approver email sent:", info1?.messageId || info1);
    } catch (mailErr1) {
      console.error("[send-delegate] approver email failed:", mailErr1);
    }

    if (delegate.EMAIL) {
      try {
        const info2 = await transporter.sendMail({
          from: '"Gaja System" <hr@gaja.ly>',
          to: delegate.EMAIL,
          subject: "Delegation Notice: Temporary Responsibilities",
          html: delegateHtml,
        });
        console.log("[send-delegate] delegate email sent:", info2?.messageId || info2);
      } catch (mailErr2) {
        console.error("[send-delegate] delegate email failed:", mailErr2);
      }
    } else {
      console.warn("Delegate has no email on file:", delegate.ID_EMP, delegate.NAME);
    }

    if (requester.EMAIL) {
      try {
        const info3 = await transporter.sendMail({
          from: '"Gaja System" <hr@gaja.ly>',
          to: requester.EMAIL,
          subject: "Your Leave Has Been Approved",
          html: requesterHtml,
        });
        console.log("[send-delegate] requester approved-leave email sent:", info3?.messageId || info3);
      } catch (mailErr3) {
        console.error("[send-delegate] requester email failed:", mailErr3);
      }
    } else {
      console.warn("Requester has no email on file:", requester.ID_EMP, requester.NAME);
    }

    res.json({
      message: "Delegation emails sent",
      delegateId: String(delegate.ID_EMP),
      returnToWork: returnToWork ? fmtISO(returnToWork) : null,
      summary: {
        entitlement: summary.entitlement,
        accruedDays: summary.accruedDays,
        usedApprovedDays: summary.usedApprovedDays,
        effectiveDaysThisRequest: summary.effectiveDaysThisRequest,
        remainingAfter: summary.remainingAfter,
      },
    });
  } catch (err) {
    console.error("Error sending delegation emails:", err);
    res.status(500).json({ message: "Failed to send emails", error: err?.message || String(err) });
  }
});

// server.js (MERGED — Part 4/4)

// ---------------- External gold spot proxy (file #1, kept as-is logic) ----------------
// Caches result for 5 minutes to reduce external calls
let __goldSpotCache = { ts: 0, data: null, attempts: 0 };

app.get("/external/gold-spot", async (req, res) => {
  const now = Date.now();
  const TTL = 5 * 60 * 1000; // 5 minutes freshness
  const MAX_STALE = 60 * 60 * 1000; // allow up to 1h stale cache for display (kept)
  const sourcesTried = [];
  let usdPerOz = null;
  let usedSource = null;
  const errors = [];

  // Serve fresh cache immediately
  if (__goldSpotCache.data && now - __goldSpotCache.ts < TTL) {
    return res.json({ ...__goldSpotCache.data, cache: true, stale: false });
  }

  // Helper to attempt fetches
  const tryFetch = async (label, fn) => {
    try {
      sourcesTried.push(label);
      const p = await fn();
      if (typeof p === "number" && !Number.isNaN(p) && p > 0) {
        usdPerOz = p;
        usedSource = label;
      }
    } catch (e) {
      errors.push({ source: label, error: String((e && e.message) || e) });
    }
  };

  // 1) metals.live dedicated gold endpoint
  await tryFetch("metals.live/spot/gold", async () => {
    const r = await axiosHttp.get("https://api.metals.live/v1/spot/gold", { timeout: 10000 });
    const arr = Array.isArray(r.data) ? r.data : [];
    for (let i = arr.length - 1; i >= 0; i--) {
      const it = arr[i];
      if (it && typeof it === "object" && Object.prototype.hasOwnProperty.call(it, "price")) {
        const p = Number(it.price);
        if (!Number.isNaN(p) && p > 0) return p;
      } else if (Array.isArray(it) && it.length >= 2) {
        const p = Number(it[1]);
        if (!Number.isNaN(p) && p > 0) return p;
      }
    }
    return null;
  });

  // 2) metals.live aggregated spot (sometimes includes gold as first element)
  if (!usdPerOz) {
    await tryFetch("metals.live/spot", async () => {
      const r = await axiosHttp.get("https://api.metals.live/v1/spot", { timeout: 10000 });
      const arr = Array.isArray(r.data) ? r.data : [];
      for (const it of arr) {
        if (it && typeof it === "object") {
          if (Object.prototype.hasOwnProperty.call(it, "gold")) {
            const p = Number(it.gold);
            if (!Number.isNaN(p) && p > 0) return p;
          }
          const p = Number(it.price);
          if (!Number.isNaN(p) && p > 0 && /gold/i.test(JSON.stringify(it))) return p;
        }
      }
      return null;
    });
  }

  // 3) goldprice.org fallback
  if (!usdPerOz) {
    await tryFetch("goldprice.org/xau", async () => {
      const r2 = await axiosHttp.get("https://data-asg.goldprice.org/dbXRates/USD", { timeout: 10000 });
      const items = r2.data && r2.data.items;
      if (Array.isArray(items) && items.length) {
        const p = Number(items[0].xauPrice || items[0].xauPrice24h || items[0].xauPricel3m);
        return !Number.isNaN(p) && p > 0 ? p : null;
      }
      return null;
    });
  }

  // 4) Emergency static fallback if everything failed and cache exists (even stale)
  if (!usdPerOz && __goldSpotCache.data) {
    return res.json({
      ...__goldSpotCache.data,
      cache: true,
      stale: now - __goldSpotCache.ts > TTL,
      warning: "Upstream gold price sources unavailable; showing cached value.",
      errors,
      sourcesTried,
    });
  }

  // 5) If still no price and no cache, respond with structured error (200)
  if (!usdPerOz) {
    return res.json({
      error: "Gold price unavailable",
      usdPerOz: null,
      usdPerGram: null,
      sourcesTried,
      errors,
      updatedAt: new Date().toISOString(),
    });
  }

  const usdPerGram = usdPerOz / 31.1034768;
  const payload = {
    usdPerOz,
    usdPerGram,
    source: usedSource || "metals.live",
    updatedAt: new Date().toISOString(),
    errors,
    sourcesTried,
  };

  __goldSpotCache = { ts: now, data: payload, attempts: (__goldSpotCache.attempts || 0) + 1 };
  res.json(payload);
});

// ---------------- Diagnostics routes (from file #1) ----------------
app.get("/__health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/__routes", (req, res) => {
  try {
    const routes = [];
    app._router.stack.forEach((layer) => {
      if (!layer.route && layer.name === "router" && layer.handle.stack) {
        layer.handle.stack.forEach((nested) => {
          if (nested.route) {
            const methods = Object.keys(nested.route.methods).map((m) => m.toUpperCase());
            routes.push({ methods, path: nested.route.path });
          }
        });
      } else if (layer.route) {
        const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
        routes.push({ methods, path: layer.route.path });
      }
    });
    res.json({ count: routes.length, routes });
  } catch (e) {
    res.status(500).json({ error: "Failed to enumerate routes", details: e.message });
  }
});

// ---------------- 404 Logger (from file #1) ----------------
app.use((req, res, next) => {
  if (res.headersSent) return next();
  let handled = false;
  res.on("finish", () => {
    if (!handled && res.statusCode === 404) {
      if (!process.env.ENABLE_404_LOG || process.env.ENABLE_404_LOG === "1") {
        console.warn(
          `[404] ${req.method} ${req.originalUrl} host=${req.headers.host || ""} referer=${
            req.headers.referer || ""
          } accept=${req.headers.accept || ""}`
        );
      }
    }
  });
  next();
});

// ---------------- Final 404 handler (BOTH files have this) ----------------
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ---------------- Start server ----------------
// file #1 used 8000, file #2 used 9000.
// To preserve both without breaking: respect env PORT first,
// otherwise default to file #1's 8000 (production), but allow easy override.
const PORT = Number(process.env.PORT) || 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
