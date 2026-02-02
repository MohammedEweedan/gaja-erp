import * as React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  CardActionArea,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import GroupIcon from "@mui/icons-material/Group";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import { hasRole } from "../getUserInfo";
import { useTranslation } from "react-i18next";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";

const SelectActionCard: React.FC = () => {
  const [selectedCard, setSelectedCard] = React.useState<number | null>(null);
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();

  // Accent like Analytics: prefer theme.palette.gaja.200
  const accent = (theme.palette as any)?.gaja?.[500];

  const cards = React.useMemo(
    () => [
      {
        id: 1,
        title: t("settings.worksPeriod.title"),
        description: t("settings.worksPeriod.desc"),
        icon: <AccessTimeIcon fontSize="large" />,
      },
      {
        id: 2,
        title: t("settings.usersList.title"),
        description: t("settings.usersList.desc"),
        icon: <GroupIcon fontSize="large" />,
        onClick: () => navigate("/setting/generals/users"),
      },
      {
        id: 3,
        title: t("settings.serverMail.title"),
        description: t("settings.serverMail.desc"),
        icon: <MarkEmailUnreadIcon fontSize="large" />,
      },
      {
        id: 4,
        title: t("settings.coaLevels.title"),
        description: t("settings.coaLevels.desc"),
        icon: <AccountTreeIcon fontSize="large" />,
      },
      {
        id: 5,
        title: t("settings.fingerprint.title"),
        description: t("settings.fingerprint.desc"),
        icon: <FingerprintIcon fontSize="large" />,
      },
    ],
    [t]
  );

  const canView = hasRole("User");
  const filteredCards = canView ? cards : [];

  return (
    <Box
      sx={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 2,
        pt: 5,
      }}
    >
      {filteredCards.map((card, index) => {
        const isActive = selectedCard === index;
        return (
          <Card
            key={card.id}
            elevation={0}
            sx={{
              // rounded "button" look
              borderRadius: 3,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: isActive ? accent : theme.palette.divider,
              overflow: "hidden",
              transition:
                "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
              "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: 6,
                borderColor: accent,
              },
              "&:focus-within": {
                outline: `2px solid ${accent}`,
                outlineOffset: 2,
              },
            }}
          >
            <CardActionArea
              onClick={() => {
                setSelectedCard(index);
                if (card.onClick) card.onClick();
              }}
              aria-pressed={isActive}
              sx={{
                height: "100%",
                p: 2,
                borderRadius: 3, // keeps rounded corners for ripple
                "& .MuiTouchRipple-root": { opacity: 0.2 },
              }}
            >
              <CardContent sx={{ display: "grid", gap: 1.25 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Box
                    aria-hidden
                    sx={{
                      color: accent,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Typography
                    variant="h6"
                    component="div"
                    sx={{ color: accent, fontWeight: 700, lineHeight: 1.2 }}
                  >
                    {card.title}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {card.description}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
};

export default SelectActionCard;
