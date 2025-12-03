import React, { useState, useEffect } from "react";
import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
  Box,
  IconButton,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import Logout from "@mui/icons-material/Logout";
import { useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

// ⬇️ import your Switch
import Switch from "../components/Switch"; // adjust path as needed

interface NavItem {
  kind?: string;
  segment?: string;
  title?: string;
  icon?: ReactNode;
  children?: NavItem[];
}

interface CustomSidebarProps {
  navigation: NavItem[];
  routeMap: Record<string, string>;
  mode: "light" | "dark";
  onToggleTheme: () => void;
  onLogout: () => void;
}

function CustomSidebar({
  navigation,
  routeMap,
  mode,
  onToggleTheme,
  onLogout,
}: CustomSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const theme = useTheme();
  const { t } = useTranslation();

  const gaja = (theme.palette as any)?.gaja as
    | Record<string, string>
    | undefined;
  const accent = gaja?.[100] ?? theme.palette.text.primary;

  const getPath = (segment: string | undefined, parent?: string) => {
    if (!segment) return "";
    if (segment.startsWith("/")) return segment;
    if (parent) return `${parent}/${segment}`;
    return `/${segment}`;
  };

  const renderNavItems = (items: NavItem[], parentPath = ""): ReactNode[] => {
    return items.map((item, idx) => {
      if (item.kind === "header") {
        return (
          <ListItemText
            key={(item.title ?? "header") + idx}
            primary={item.title ? t(item.title) : ""}
            sx={{ pl: 2, pt: 2, fontWeight: 700, color: accent }}
          />
        );
      }
      if (item.kind === "divider") {
        return <Divider key={idx} sx={{ my: 1 }} />;
      }
      if (item.children) {
        const fullPath = getPath(item.segment, parentPath);
        const isOpen =
          expanded[fullPath] || location.pathname.startsWith(fullPath);
        return (
          <React.Fragment key={(item.title ?? "group") + idx}>
            <ListItemButton
              onClick={() =>
                setExpanded((e) => ({ ...e, [fullPath]: !isOpen }))
              }
              selected={location.pathname.startsWith(fullPath)}
              sx={{ color: accent }}
            >
              {item.icon && (
                <ListItemIcon sx={{ color: "inherit" }}>
                  {item.icon}
                </ListItemIcon>
              )}
              <ListItemText primary={item.title ? t(item.title) : ""} />
              {isOpen ? (
                <ExpandLess sx={{ color: "inherit" }} />
              ) : (
                <ExpandMore sx={{ color: "inherit" }} />
              )}
            </ListItemButton>
            <Collapse in={isOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {renderNavItems(item.children, fullPath)}
              </List>
            </Collapse>
          </React.Fragment>
        );
      }
      const fullPath = getPath(item.segment, parentPath);
      return (
        <ListItemButton
          key={(item.title ?? "item") + idx}
          selected={location.pathname === fullPath}
          onClick={() => navigate(fullPath)}
          sx={{ pl: parentPath ? 4 : 2, color: accent }}
        >
          {item.icon && (
            <ListItemIcon sx={{ color: "inherit" }}>{item.icon}</ListItemIcon>
          )}
          <ListItemText primary={item.title ? t(item.title) : ""} />
        </ListItemButton>
      );
    });
  };

  useEffect(() => {
    function expandForPath(items: NavItem[], parentPath = "") {
      items.forEach((item) => {
        if (item.children) {
          const fullPath = getPath(item.segment, parentPath);
          if (location.pathname.startsWith(fullPath)) {
            setExpanded((e) => ({ ...e, [fullPath]: true }));
            expandForPath(item.children, fullPath);
          }
        }
      });
    }
    expandForPath(navigation);
  }, [location.pathname, navigation]);

  return (
    <Box
      sx={{
        width: 260,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
      }}
    >
      <List component="nav" sx={{ flex: 1, overflowY: "auto" }}>
        {renderNavItems(navigation)}
      </List>
      <Box
        sx={{
          p: 2,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <IconButton
          onClick={onLogout}
          color="inherit"
          aria-label={t("sidebar.logout")}
          sx={{ ml: 1, color: accent }}
        >
          <Logout sx={{ color: "inherit", mr: 1 }} />
          {t("sidebar.logout")}
        </IconButton>
      </Box>
    </Box>
  );
}

export default CustomSidebar;
