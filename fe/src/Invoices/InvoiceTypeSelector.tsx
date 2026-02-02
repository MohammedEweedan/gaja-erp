import React, { useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import DiamondIcon from "@mui/icons-material/Diamond";
import WatchIcon from "@mui/icons-material/Watch";
import GInvoices from "../Invoices/GInvoices";

const typeOptions = [
  {
    label: "Gold",
    value: "gold",
    icon: <EmojiEventsIcon sx={{ fontSize: 60, color: "#FFD700" }} />,
  },
  {
    label: "Diamond",
    value: "diamond",
    icon: <DiamondIcon sx={{ fontSize: 60, color: "#B9F2FF" }} />,
  },
  {
    label: "Watch",
    value: "watch",
    icon: <WatchIcon sx={{ fontSize: 60, color: "#888" }} />,
  },
];

export default function InvoiceTypeSelector() {
  const [selectedType, setSelectedType] = useState<string | null>(null);

  if (selectedType) {
    return <GInvoices Type={selectedType} />;
  }

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" align="center" gutterBottom>
        Select Invoice Type
      </Typography>
      <Box sx={{ display: "flex", justifyContent: "center", gap: 4, mt: 4 }}>
        {typeOptions.map((opt) => (
          <Paper
            key={opt.value}
            elevation={6}
            sx={{
              p: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              cursor: "pointer",
              transition: "0.2s",
              "&:hover": {
                boxShadow: 12,
                backgroundColor: "primary.light",
                color: "white",
              },
              minWidth: 200,
              minHeight: 200,
            }}
            onClick={() => setSelectedType(opt.value)}
          >
            {opt.icon}
            <Typography variant="h6" sx={{ mt: 2 }}>
              {opt.label}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
