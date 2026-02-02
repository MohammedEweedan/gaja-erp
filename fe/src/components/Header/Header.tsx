// src/components/Header/Header.tsx
import React, { useState } from "react";
import RateTbForm from "../../Setup/RateTbForm";
import RateTbList from "../../Setup/RateTbList";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  IconButton,
  Box,
  Container,
  Stack,
  Tooltip,
  styled,
  Chip,
  Button,
} from "@mui/material";
import {
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
} from "@mui/icons-material";
import LanguageSwitcher from "../LanguageSwitcher";
import { useThemeContext } from "../../theme/ThemeProvider";
import Logo from "../../ui-component/Logo";
import { useAuth } from "../../contexts/AuthContext";

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  backgroundImage: "none",
  borderBottom: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1, 0),
  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  position: "sticky",
  top: 0,
  zIndex: theme.zIndex.appBar,
}));

const Header: React.FC = () => {
  const { t } = useTranslation();
  const { mode, toggleColorMode } = useThemeContext();
  // dev evidence
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("Header component render - dev build");
  }
  // Read Prvilege and map to friendly label: Admin > Accounting > User
  // Auth context (contains user and updatePs)
  const auth = useAuth();

  const roleLabel = (() => {
    const normalizeRoles = (input: any): string[] => {
      if (!input) return [];
      if (Array.isArray(input)) {
        return input
          .map((r) =>
            typeof r === "string"
              ? r
              : String(
                  (r as any)?.name || (r as any)?.role || (r as any)?.value || r
                )
          )
          .flatMap((s) => String(s).split(/[\s,;]+/))
          .filter(Boolean)
          .map((s) => s.toUpperCase());
      }
      if (typeof input === "string") {
        return input
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map((s) => s.toUpperCase());
      }
      if (typeof input === "object") {
        const s = String(
          (input as any).name ||
            (input as any).role ||
            (input as any).value ||
            ""
        );
        return s
          ? s
              .split(/[\s,;]+/)
              .filter(Boolean)
              .map((x) => x.toUpperCase())
          : [];
      }
      return [];
    };

    try {
      let roles: string[] = [];

      // Prefer the auth context user if available
      if (auth?.user) {
        roles = roles.concat(
          normalizeRoles(
            (auth.user as any).roles ??
              (auth.user as any).role ??
              (auth.user as any).Prvilege
          )
        );
      }

      // Fallback to legacy localStorage shapes
      if (roles.length === 0) {
        const u = localStorage.getItem("user");
        if (u) {
          const obj = JSON.parse(u);
          roles = roles.concat(
            normalizeRoles(
              obj?.Prvilege ?? obj?.roles ?? obj?.Roles ?? obj?.Action_user
            )
          );
        }
      }

      if (roles.length === 0) {
        const standalone =
          localStorage.getItem("Prvilege") || localStorage.getItem("roles");
        if (standalone) {
          try {
            roles = roles.concat(normalizeRoles(JSON.parse(standalone)));
          } catch {
            roles = roles.concat(normalizeRoles(standalone));
          }
        }
      }

      // final fallback: raw string check for ROLE_ADMIN
      if (roles.length === 0) {
        try {
          const raw = localStorage.getItem("user") || "";
          if (raw && raw.toUpperCase().includes("ROLE_ADMIN"))
            roles.push("ROLE_ADMIN");
        } catch {}
      }

      const has = (needle: string) =>
        roles.some((r) => r === needle || r.includes(needle));
      if (has("ROLE_ADMIN") || has("ADMIN")) return "Admin";
      if (has("ROLE_ACCOUNT") || has("ACCOUNT")) return "Accounting";
      if (has("ROLE_USER") || has("USER")) return "User";
      return "";
    } catch {
      return "";
    }
  })();

  // More permissive admin check (covers auth.user.role, auth.user.roles arrays, and legacy storage)
  const isAdmin = (() => {
    try {
      // auth-first
      if (auth?.user) {
        const u: any = auth.user as any;
        const roleField = (u.role ??
          u.roles ??
          u.Prvilege ??
          u.Roles ??
          u.Action_user) as any;
        if (!roleField) return false;
        if (typeof roleField === "string") {
          const s = roleField.trim();
          return (
            s.toUpperCase() === "ROLE_ADMIN" ||
            s.toLowerCase().includes("admin")
          );
        }
        if (Array.isArray(roleField)) {
          return roleField.some((r) => {
            const s = String(r).trim();
            return (
              s.toUpperCase() === "ROLE_ADMIN" ||
              s.toLowerCase().includes("admin")
            );
          });
        }
        // object-ish
        const s = String(roleField).trim();
        return (
          s.toUpperCase() === "ROLE_ADMIN" || s.toLowerCase().includes("admin")
        );
      }

      // fallback to localStorage
      const uRaw = localStorage.getItem("user");
      if (uRaw) {
        // raw-string quick check
        if (uRaw.toUpperCase().includes("ROLE_ADMIN")) return true;
        const obj = JSON.parse(uRaw) as any;
        const roleField =
          obj?.roles ?? obj?.Prvilege ?? obj?.Roles ?? obj?.Action_user;
        if (!roleField) return false;
        if (typeof roleField === "string") {
          const s = roleField.trim();
          return (
            s.toUpperCase() === "ROLE_ADMIN" ||
            s.toLowerCase().includes("admin")
          );
        }
        if (Array.isArray(roleField)) {
          return roleField.some((r) => {
            const s = String(r).trim();
            return (
              s.toUpperCase() === "ROLE_ADMIN" ||
              s.toLowerCase().includes("admin")
            );
          });
        }
        return String(roleField).toLowerCase().includes("admin");
      }

      return false;
    } catch (e) {
      return false;
    }
  })();

  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [rateListOpen, setRateListOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  // DEBUG: Log admin detection context
  if (typeof window !== 'undefined') {
    console.log("isAdmin:", isAdmin, "auth.user:", auth.user, "localStorage user:", localStorage.getItem("user"));
  }

  return (
    <StyledAppBar>
      <Container maxWidth={false}>
        <Toolbar disableGutters>
          {/* Brand */}
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Link to="/">
              <Logo />
            </Link>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* DEV: visible banner to confirm this Header is active */}
          {process.env.NODE_ENV === "development" && (
            <Box
              sx={{
                position: "absolute",
                right: 16,
                top: 8,
                bgcolor: "error.main",
                color: "common.white",
                px: 1,
                py: 0.3,
                borderRadius: 1,
                fontSize: 12,
                zIndex: 2000,
              }}
            >
              HEADER-DEV
            </Box>
          )}

          {/* Right side actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            {/* User Role (from localStorage.user.Prvilege) */}
            {roleLabel && (
              <Chip
                label={roleLabel}
                color={roleLabel === "Admin" ? "warning" : "default"}
                size="small"
                sx={{ fontWeight: 800, letterSpacing: 0.3 }}
              />
            )}
             
            {/* Theme Toggle */}
            <Tooltip
              title={
                mode === "dark"
                  ? t("header.lightMode") || "Light mode"
                  : t("header.darkMode") || "Dark mode"
              }
            >
              <IconButton
                onClick={toggleColorMode}
                color="inherit"
                sx={{
                  color: "text.primary",
                  "&:hover": { backgroundColor: "action.hover" },
                }}
              >
                {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>

            {/* Language */}
            <LanguageSwitcher />
        
          </Stack>
           
          
        </Toolbar>
      </Container>
    </StyledAppBar>
  );
};

export default Header;
