const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

// Models
const Purchase = require("../../models/sales/Purchase");    // ACHAT
const Supplier = require("../../models/sales/Supplier");    // Fournisseur
const User = require("../../models/hr/user");               // Utilisateur
const Pic = require("../../models/sales/Pic");
const Invoice = require("../../models/sales/Invoice");      // Facture
const Inventory = require("../../models/inventory/inventory");

const DistributionPurchase = require("../../models/sales/DistributionPurchase");
const OriginalAchatDiamonds = require("../../models/Purchase/DiamonOriginalAchat");
const WachtchesOriginalAchat = require("../../models/Purchase/WachtchesOriginalAchat");

// ================== ASSOCIATIONS (define ONCE) ==================

// Purchase ↔ Supplier
Purchase.belongsTo(Supplier, {
  foreignKey: "client",
  as: "Supplier",
});
Supplier.hasMany(Purchase, {
  foreignKey: "client",
  as: "Purchases",
  useJunctionTable: false,
});

// Purchase ↔ User
Purchase.belongsTo(User, {
  foreignKey: "usr",
  as: "User",
});
User.hasMany(Purchase, {
  foreignKey: "usr",
  as: "Purchases",
  useJunctionTable: false,
});

// Purchase ↔ Invoice (Facture)  (alias as "Factures"!)
Purchase.hasMany(Invoice, {
  foreignKey: "id_art",   // Facture.id_art
  sourceKey: "id_fact",   // ACHAT.id_fact
  as: "Factures",
});
Invoice.belongsTo(Purchase, {
  foreignKey: "id_art",
  targetKey: "id_fact",
  as: "Achat",
});

// Purchase ↔ DistributionPurchase
Purchase.hasOne(DistributionPurchase, {
  foreignKey: "distributionID",
  sourceKey: "Original_Invoice",
  as: "Distribution",
});
DistributionPurchase.belongsTo(Purchase, {
  foreignKey: "distributionID",
  targetKey: "Original_Invoice",
  as: "Purchase",
});

// DistributionPurchase ↔ Original diamond purchase
DistributionPurchase.hasOne(OriginalAchatDiamonds, {
  foreignKey: "id_achat",
  sourceKey: "PurchaseID",
  as: "DiamondOriginal",
});
OriginalAchatDiamonds.belongsTo(DistributionPurchase, {
  foreignKey: "id_achat",
  targetKey: "PurchaseID",
  as: "Distribution",
});

// DistributionPurchase ↔ Original watch purchase
DistributionPurchase.hasOne(WachtchesOriginalAchat, {
  foreignKey: "id_achat",
  sourceKey: "PurchaseID",
  as: "WatchOriginal",
});
WachtchesOriginalAchat.belongsTo(DistributionPurchase, {
  foreignKey: "id_achat",
  targetKey: "PurchaseID",
  as: "DistributionWatch",
});

// ================== AUTH HELPER ==================

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Token missing" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: "Invalid or expired token" });
    req.user = decoded;
    next();
  });
}

// ================== CONTROLLERS ==================

// 1) Find active purchases: ACHAT.qty - Factures.qty > 0
exports.findActive = [
  requireAuth,
  async (req, res) => {
    try {
      const { ps, type_supplier } = req.query;

      const whereCondition = {};
      if (ps) whereCondition.ps = ps;

      const includeConditions = [
        {
          model: Supplier,
          as: "Supplier",
          attributes: [
            "client_name",
            "code_supplier",
            "TYPE_SUPPLIER",
            "Price_G_Gold",
            "Price_G_Gold_Sales",
            "Percentage_Diamond",
          ],
          where: {},
        },
        {
          model: User,
          as: "User",
          attributes: ["id_user", "name_user", "email"],
        },
        {
          model: Invoice,
          as: "Factures",
          attributes: ["id_art", "qty"],
          required: false, // LEFT JOIN
        },
      ];

      if (type_supplier) {
        includeConditions[0].where.TYPE_SUPPLIER = {
          [Op.like]: `%${type_supplier}%`,
        };

        const lower = type_supplier.toLowerCase();

        if (lower.includes("diamond")) {
          includeConditions.push({
            model: DistributionPurchase,
            as: "Distribution",
            required: false,
            include: [
              {
                model: OriginalAchatDiamonds,
                as: "DiamondOriginal",
                required: false,
              },
            ],
          });
        } else if (lower.includes("watch")) {
          includeConditions.push({
            model: DistributionPurchase,
            as: "Distribution",
            required: false,
            include: [
              {
                model: WachtchesOriginalAchat,
                as: "WatchOriginal",
                required: false,
              },
            ],
          });
        }
      }

      const sequelize = Purchase.sequelize;
      const qtyDiffExpr = sequelize.literal(
        "COALESCE([ACHAT].[qty], 0) - COALESCE([Factures].[qty], 0)"
      );

      const purchases = await Purchase.findAll({
        where: {
          ...whereCondition,
          [Op.and]: [sequelize.where(qtyDiffExpr, ">", 0)],
        },
        include: includeConditions,
        attributes: {
          include: [[qtyDiffExpr, "qty_difference"]],
        },
      });

      // 🔥 send in a shape that’s easy for frontend
      return res.json({
        success: true,
        count: purchases.length,
        purchases,
      });
    } catch (dbErr) {
      console.error("Fetch Purchases Error:", dbErr);
      return res.status(500).json({ message: "Error fetching purchases" });
    }
  },
];

// 2) Get Pic(s) by id_art (still available as its own endpoint)
exports.findPic = [
  requireAuth,
  async (req, res) => {
    try {
      const { id_art } = req.query;
      const whereCondition = {};
      if (id_art) whereCondition.id_art = id_art;

      const pics = await Pic.findAll({ where: whereCondition });
      return res.json(pics);
    } catch (dbErr) {
      console.error("Fetch pics Error:", dbErr);
      return res.status(500).json({ message: "Error fetching pics" });
    }
  },
];

// 3) List inventory
exports.listInventory = [
  requireAuth,
  async (req, res) => {
    try {
      const {
        id_inv,
        ps,
        id_art,
        is_active,
        date_from,
        date_to,
        limit,
        offset,
        order_by,
        order_dir,
      } = req.query || {};

      const where = {};
      if (id_inv) where.id_inv = id_inv;
      if (ps) where.ps = ps;
      if (id_art) where.id_art = id_art;

      if (typeof is_active !== "undefined") {
        const b = String(is_active).toLowerCase();
        where.is_active = b === "true" || b === "1";
      }

      if (date_from || date_to) {
        where.date_inv = {};
        if (date_from) where.date_inv[Op.gte] = date_from;
        if (date_to) where.date_inv[Op.lte] = date_to;
      }

      const ord = [];
      if (order_by) {
        ord.push([
          String(order_by),
          String(order_dir || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC",
        ]);
      } else {
        ord.push(["id_inv", "DESC"]);
      }

      const lmt = Number.isFinite(Number(limit))
        ? Math.min(Number(limit), 500)
        : undefined;
      const off = Number.isFinite(Number(offset)) ? Number(offset) : undefined;

      const rows = await Inventory.findAll({
        where,
        order: ord,
        limit: lmt,
        offset: off,
      });

      return res.json(rows);
    } catch (e) {
      console.error("List Inventory Error:", e);
      return res.status(500).json({ message: "Error fetching inventory records" });
    }
  },
];

// 4) Create inventory
exports.createInventory = [
  requireAuth,
  async (req, res) => {
    try {
      const {
        date_inv,
        Teams,
        ps,
        id_art,
        date_time_check,
        checked_by,
        device,
        location,
        ip_Address,
        is_active,
      } = req.body || {};

      const created = await Inventory.create({
        date_inv: date_inv ?? null,
        Teams: Teams ?? null,
        ps: ps ?? null,
        id_art: id_art ?? null,
        date_time_check: date_time_check ?? null,
        checked_by: checked_by ?? null,
        device: device ?? null,
        location: location ?? null,
        ip_Address: ip_Address ?? null,
        is_active:
          typeof is_active === "boolean"
            ? is_active
            : is_active == null
            ? null
            : !!is_active,
      });

      return res.status(201).json(created);
    } catch (e) {
      console.error("Create Inventory Error:", e);
      return res.status(500).json({ message: "Error creating inventory record" });
    }
  },
];

// 5) Update inventory
exports.updateInventory = [
  requireAuth,
  async (req, res) => {
    try {
      const id = req.params.id_inv || req.body.id_inv;
      if (!id) return res.status(400).json({ message: "id_inv is required" });

      const inv = await Inventory.findByPk(id);
      if (!inv) return res.status(404).json({ message: "Inventory record not found" });

      const allowed = [
        "date_inv",
        "Teams",
        "ps",
        "id_art",
        "date_time_check",
        "checked_by",
        "device",
        "location",
        "ip_Address",
        "is_active",
      ];
      const updates = {};

      for (const k of allowed) {
        if (Object.prototype.hasOwnProperty.call(req.body, k)) {
          if (k === "is_active") {
            updates[k] =
              typeof req.body[k] === "boolean" ? req.body[k] : !!req.body[k];
          } else {
            updates[k] = req.body[k];
          }
        }
      }

      await inv.update(updates);
      return res.json(inv);
    } catch (e) {
      console.error("Update Inventory Error:", e);
      return res.status(500).json({ message: "Error updating inventory record" });
    }
  },
];

// 6) Delete inventory
exports.deleteInventory = [
  requireAuth,
  async (req, res) => {
    try {
      const id = req.params.id_inv || req.body.id_inv;
      if (!id) return res.status(400).json({ message: "id_inv is required" });

      const deleted = await Inventory.destroy({ where: { id_inv: id } });
      if (!deleted)
        return res.status(404).json({ message: "Inventory record not found" });

      return res.json({ message: "Inventory record deleted", id_inv: id });
    } catch (e) {
      console.error("Delete Inventory Error:", e);
      return res.status(500).json({ message: "Error deleting inventory record" });
    }
  },
];

// 7) Activate / deactivate inventory session
exports.activateInventorySession = [
  requireAuth,
  async (req, res) => {
    try {
      const { date_inv, ps, is_active } = req.body || {};
      if (!date_inv || typeof ps === "undefined") {
        return res.status(400).json({ message: "date_inv and ps are required" });
      }

      const dateKey = String(date_inv).slice(0, 10); // YYYY-MM-DD
      const psKey = Number(ps);

      if (!dateKey || Number.isNaN(psKey)) {
        return res.status(400).json({ message: "Invalid date_inv or ps" });
      }

      const desired =
        typeof is_active === "boolean" ? is_active : !!is_active || true;

      const [count] = await Inventory.update(
        { is_active: desired },
        { where: { date_inv: dateKey, ps: psKey } }
      );

      return res.json({
        updated: count,
        date_inv: dateKey,
        ps: psKey,
        is_active: desired,
      });
    } catch (e) {
      console.error("Activate Inventory Session Error:", e);
      return res
        .status(500)
        .json({ message: "Error activating inventory session" });
    }
  },
];
