// Profile picture upload endpoint

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const connect = require("./config/database");
const nodemailer = require("nodemailer");
const OriginalAchat = require("./models/Purchase/GoldOriginalAchat"); // <-- Add this
const images = require("./images");

const uploadWatchPic = require("./uploadWatchPic");
const uploadDiamondFiles = require("./uploadDiamondFiles");
// Import all routes
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
const ShareRoutes = require("./routes/ShareRoutes");
const NotificationRoutes = require("./routes/NotificationRoute");
const employees = require("./routes/SetupRoutes/employeeRoutes");
const users = require("./routes/LoginRoute/userRoutes");
const RateTbRoute = require("./routes/RateTbRoute");
const LogRoute = require('./routes/LogRoute');
const RolesTBRoute = require("./routes/RolesTBRoute");
const LogTransferRoute = require("./routes/LogTransferRoute");
const PushTokensRoute = require("./routes/PushTokensRoute");
// Initialize Express
const app = express();

// Database connection
connect();




const fs = require("fs");

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const purchaseUploadDir = path.join(__dirname, "uploads", "purchase");
if (!fs.existsSync(purchaseUploadDir)) {
  fs.mkdirSync(purchaseUploadDir, { recursive: true });
}




require("dotenv").config();

require("./uploadWatchPic")(app);
require("./uploadDiamondFiles")(app);

// CORS must be before any routes or static files
const allowedOrigins = [
 // "http://102.213.182.8:3000",
//  "http://102.213.182.8:8000",
 // "http://gaja.server.ly",
  "http://localhost:3000",
  "http://localhost:8000",
  "http://localhost:9000",   
  "http://localhost:9000:8000",
];


app.use(cors({
  origin: function (origin, callback) {
    // السماح للطلبات بدون origin (مثلاً Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));




// Compatibility middleware: allow clients to call endpoints with an `/api` prefix
// (e.g. `/api/Opurchases/upload-attachment`) and rewrite the URL to match
// existing routes that are registered without the `/api` prefix.
app.use((req, res, next) => {
  try {
    if (req.path && req.path.startsWith('/api/')) {
      // Strip the leading `/api` so the rest of the routing works unchanged
      req.url = req.url.replace(/^\/api/, '');
    }
  } catch (e) {
    // Don't block the request on a rewrite error
    console.warn('API-prefix rewrite error:', e && e.message ? e.message : e);
  }
  next();
});






// Multer storage for user-pic uploads (must be defined before using in route)
const userPicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save in uploads/user-pic/<id_employee>
    const id_employee = req.body.id_employee || req.query.id_employee;
    const userPicPath = path.join(__dirname, "uploads", "user-pic", String(id_employee));
    if (!fs.existsSync(userPicPath)) {
      fs.mkdirSync(userPicPath, { recursive: true });
    }
    cb(null, userPicPath);
  },
  filename: (req, file, cb) => {
    // Always save as profile.jpg for each employee
    cb(null, "profile.jpg");
  }
});
const userPicUpload = multer({ storage: userPicStorage });


// Register /employees/upload-profile-pic endpoint BEFORE /employees router

// Apply body parsers BEFORE /employees route so req.body is available
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Register /employees route AFTER upload-profile-pic so it doesn't override the upload endpoint


// Other routes

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
app.use("/", PushTokensRoute);

app.use("/rate-tb", RateTbRoute);
 app.use("/roles", RolesTBRoute);
app.use('/taking_images', LogRoute);

app.use('/notification', NotificationRoutes);


app.use("/", router);
























// Lightweight proxy for external gold spot price (avoids frontend CORS)
// Caches result for 5 minutes to reduce external calls
let __goldSpotCache = { ts: 0, data: null, attempts: 0 };
app.get("/external/gold-spot", async (req, res) => {
  const now = Date.now();
  const TTL = 5 * 60 * 1000; // 5 minutes freshness
  const MAX_STALE = 60 * 60 * 1000; // allow up to 1h stale cache for display
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
      errors.push({ source: label, error: String(e && e.message || e) });
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
      // Look for gold price heuristic: object with gold key or entry with price & name
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
        return (!Number.isNaN(p) && p > 0) ? p : null;
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

  // 5) If still no price and no cache, respond with structured error (200) so frontend does not treat as network failure.
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































app.post("/employees/upload-profile-pic", userPicUpload.single("profile_pic"), (req, res) => {
  const id_employee = req.body.id_employee || req.query.id_employee;
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  // Return the image URL with id_employee in the path
  const fileUrl = `/uploads/user-pic/${id_employee}/profile.jpg`;
  res.json({ imageUrl: fileUrl, fileUrl });
});






// Static files (for uploaded PDFs and user-pic)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads/user-pic", express.static(path.join(__dirname, "uploads", "user-pic")));
// Static files (for uploaded purchase PDFs)
app.use("/uploads/purchase", express.static(path.join(__dirname, "uploads", "purchase")));
app.use("/uploads/WOpurchase", express.static(path.join(__dirname, "uploads", "WOpurchase")));
app.use("/uploads/DOpurchase", express.static(path.join(__dirname, "uploads", "DOpurchase")));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// File upload endpoint
app.post("/upload", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ link: fileUrl });
});

// File upload endpoint for purchase attachments
const purchaseStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Get id_achat from body or query
    let id_achat = req.body.id_achat || req.query.id_achat;
    if (!id_achat) {
      // fallback: put in a temp folder
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
  }
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
  // Build URLs for all files
  const fileUrls = req.files.map(file => `${req.protocol}://${req.get("host")}/uploads/purchase/${id_achat}/${file.filename}`);
  try {
    // Update the purchase record with the list of attachment URLs (as JSON string)
    await OriginalAchat.update(
      { attachmentUrl: JSON.stringify(fileUrls) },
      { where: { id_achat } }
    );
    res.json({ links: fileUrls });
  } catch (err) {
    res.status(500).json({ error: "Failed to update purchase with attachments" });
  }
});

// File upload endpoint for diamond purchase attachments
const diamondPurchaseStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/purchase/"); // You can use a separate folder if you want
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
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
    // Update the diamond purchase record with the attachmentUrl
    const OriginalAchat = require("./models/Purchase/DiamonOriginalAchat");
    await OriginalAchat.update(
      { attachmentUrl: fileUrl },
      { where: { id_achat } }
    );
    res.json({ link: fileUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to update diamond purchase with attachment" });
  }
});



 

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

    // Build HTML table for purchase info
    let htmlBody = `<h2>Purchase Approval Needed</h2>
    <p>Please review the following purchase details:</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;">
      <tr><th align="left">Note</th><td>${purchaseInfo?.Comment_Achat || ''}</td></tr>
      <tr><th align="left">Date</th><td>${purchaseInfo?.Date_Achat || ''}</td></tr>
      <tr><th align="left">Full Weight</th><td>${purchaseInfo?.FullWeight || ''}</td></tr>
      <tr><th align="left">Net Weight</th><td>${purchaseInfo?.NetWeight || ''}</td></tr>
      <tr><th align="left">Brand</th><td>${purchaseInfo?.Supplier || ''}</td></tr>
      <tr><th align="left">Document No</th><td>${purchaseInfo?.DocumentNo || ''}</td></tr>
      <tr><th align="left">Stone Details</th><td>${purchaseInfo?.Stone_Details || ''}</td></tr>
      <tr><th align="left">Net Details</th><td>${purchaseInfo?.Net_Details || ''}</td></tr>
      <tr><th align="left">Purity</th><td>${purchaseInfo?.Purity || ''}</td></tr>
      <tr><th align="left">Pure Wt</th><td>${purchaseInfo?.PureWt || ''}</td></tr>
      <tr><th align="left">Making Stone Rate</th><td>${purchaseInfo?.MakingStoneRate || ''}</td></tr>
      <tr><th align="left">Making Stone Value</th><td>${purchaseInfo?.MakingStoneValue || ''}</td></tr>
      <tr><th align="left">Metal Value</th><td>${purchaseInfo?.MetalValue || ''}</td></tr>
    </table>
    <p>See the attached file for more details.</p>
    <p>pls Login to system and your action.</p>`;

    // Configure your transporter (update with your SMTP credentials)
    const transporter = nodemailer.createTransport({
      host: 'mail.gaja.ly',
      port: 587,
      secure: false,
      auth: {
        user: 'info@gaja.ly',
        pass: 'P@$$word123'
      }
    });

    // Send the email
    await transporter.sendMail({
      from: '"Gaja System" <hr@gaja.ly>',
      to: email,
      subject: 'Purchase Approval Needed',
      html: htmlBody,
      attachments: [
        {
          filename: achat.attachmentUrl.split('/').pop(),
          path: achat.attachmentUrl
        }
      ]
    });

    res.json({ message: 'Approval email sent!' });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ message: 'Failed to send email', error: err.message });
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

    // Build HTML table for diamond purchase info
    let htmlBody = `<h2>Diamond Purchase Approval Needed</h2>
    <p>Please review the following diamond purchase details:</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;">
      <tr><th align="left">Comment</th><td>${purchaseInfo?.Comment_Achat || ''}</td></tr>
      <tr><th align="left">Date</th><td>${purchaseInfo?.Date_Achat || ''}</td></tr>
      <tr><th align="left">Carat</th><td>${purchaseInfo?.carat || ''}</td></tr>
      <tr><th align="left">Supplier</th><td>${purchaseInfo?.Supplier || ''}</td></tr>
      <tr><th align="left">Document No</th><td>${purchaseInfo?.DocumentNo || ''}</td></tr>
      <tr><th align="left">Certificate #</th><td>${purchaseInfo?.certificate_number || ''}</td></tr>
      <tr><th align="left">Certificate Lab</th><td>${purchaseInfo?.certificate_lab || ''}</td></tr>
      <tr><th align="left">Total Price</th><td>${purchaseInfo?.total_price || ''}</td></tr>
      <tr><th align="left">Price/Carat</th><td>${purchaseInfo?.price_per_carat || ''}</td></tr>
      <tr><th align="left">Shape</th><td>${purchaseInfo?.shape || ''}</td></tr>
      <tr><th align="left">Color</th><td>${purchaseInfo?.color || ''}</td></tr>
      <tr><th align="left">Clarity</th><td>${purchaseInfo?.clarity || ''}</td></tr>
      <tr><th align="left">Cut</th><td>${purchaseInfo?.cut || ''}</td></tr>
    </table>
    <p>See the attached file for more details.</p>
    <p>Please login to the system to take action.</p>`;

    // Configure your transporter (update with your SMTP credentials)
    const transporter = require("nodemailer").createTransport({
      host: 'mail.gaja.ly',
      port: 587,
      secure: false,
      auth: {
        user: 'info@gaja.ly',
        pass: 'P@$$word123'
      }
    });

    // Send the email
    await transporter.sendMail({
      from: '"Gaja System" <hr@gaja.ly>',
      to: email,
      subject: 'Diamond Purchase Approval Needed',
      html: htmlBody,
      attachments: [
        {
          filename: achat.attachmentUrl.split('/').pop(),
          path: achat.attachmentUrl
        }
      ]
    });

    res.json({ message: 'Approval email sent!' });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ message: 'Failed to send email', error: err.message });
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

    // Build HTML table for watch purchase info
    let htmlBody = `<h2>Watch Purchase Approval Needed</h2>
    <p>Please review the following watch purchase details:</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;">
      <tr><th align="left">Comment</th><td>${purchaseInfo?.Comment_Achat || ''}</td></tr>
      <tr><th align="left">Date</th><td>${purchaseInfo?.Date_Achat || ''}</td></tr>
      <tr><th align="left">Model</th><td>${purchaseInfo?.model || ''}</td></tr>
      <tr><th align="left">Supplier</th><td>${purchaseInfo?.Supplier || ''}</td></tr>
      <tr><th align="left">Document No</th><td>${purchaseInfo?.DocumentNo || ''}</td></tr>
      <tr><th align="left">Reference #</th><td>${purchaseInfo?.reference_number || ''}</td></tr>
      <tr><th align="left">Serial #</th><td>${purchaseInfo?.serial_number || ''}</td></tr>
      <tr><th align="left">Sale Price</th><td>${purchaseInfo?.sale_price || ''}</td></tr>
      <tr><th align="left">Retail Price</th><td>${purchaseInfo?.retail_price || ''}</td></tr>
      <tr><th align="left">Condition</th><td>${purchaseInfo?.condition || ''}</td></tr>
      <tr><th align="left">Diamond Carat</th><td>${purchaseInfo?.diamond_total_carat || ''}</td></tr>
      <tr><th align="left">Diamond Quality</th><td>${purchaseInfo?.diamond_quality || ''}</td></tr>
      <tr><th align="left">Box/Papers</th><td>${purchaseInfo?.box_papers ? 'Yes' : 'No'}</td></tr>
    </table>
    <p>See the attached file for more details.</p>
    <p>Please login to the system to take action.</p>`;

    // Configure your transporter (update with your SMTP credentials)
    const transporter = require("nodemailer").createTransport({
      host: 'mail.gaja.ly',
      port: 587,
      secure: false,
      auth: {
        user: 'info@gaja.ly',
        pass: 'P@$$word123'
      }
    });

    // Send the email
    await transporter.sendMail({
      from: '"Gaja System" <hr@gaja.ly>',
      to: email,
      subject: 'Watch Purchase Approval Needed',
      html: htmlBody,
      attachments: [
        {
          filename: achat.attachmentUrl.split('/').pop(),
          path: achat.attachmentUrl
        }
      ]
    });

    res.json({ message: 'Approval email sent!' });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ message: 'Failed to send email', error: err.message });
  }
});
 

// Import and use uploadWatchPic.js for /WOpurchases/upload-attachment










// ====== Diagnostics: List registered routes (GET /__routes) & health (GET /__health) ======
app.get('/__health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/__routes', (req, res) => {
  try {
    const routes = [];
    app._router.stack.forEach((layer) => {
      if (!layer.route && layer.name === 'router' && layer.handle.stack) {
        // Nested router
        layer.handle.stack.forEach((nested) => {
          if (nested.route) {
            const methods = Object.keys(nested.route.methods).map(m => m.toUpperCase());
            routes.push({ methods, path: nested.route.path });
          }
        });
      } else if (layer.route) {
        const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
        routes.push({ methods, path: layer.route.path });
      }
    });
    res.json({ count: routes.length, routes });
  } catch (e) {
    res.status(500).json({ error: 'Failed to enumerate routes', details: e.message });
  }
});

// ====== 404 Logger (must stay BEFORE the final 404 handler) ======
// Logs only unmatched requests. Guard with env var ENABLE_404_LOG=1 if you want to reduce noise.
app.use((req, res, next) => {
  // If response already sent, skip
  if (res.headersSent) return next();
  // Defer logging until after other middlewares by attaching a finish listener only if no route matched.
  let handled = false;
  res.on('finish', () => {
    if (!handled && res.statusCode === 404) {
      if (!process.env.ENABLE_404_LOG || process.env.ENABLE_404_LOG === '1') {
        console.warn(`[404] ${req.method} ${req.originalUrl} host=${req.headers.host || ''} referer=${req.headers.referer || ''} accept=${req.headers.accept || ''}`);
      }
    }
  });
  next();
});

// Error handling for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


