import React, { useEffect, useState } from "react";
import { Box, Typography, TextField, Button } from "@mui/material";
import axios from "../api";

const apiIp = process.env.REACT_APP_API_IP;

interface ChiraReturnPageProps {
  id_fact: string;
  onClose: () => void;
  onUpdated?: () => void;
}

const ChiraReturnPage = ({
  id_fact,
  onClose,
  onUpdated,
}: ChiraReturnPageProps) => {
  const [returnChira, setReturnChira] = useState("");
  const [commentChira, setCommentChira] = useState("");
  const [chiraUser, setChiraUser] = useState("");
  const [loading, setLoading] = useState(false);

  let ps: string | null = null;
  let Cuser: string | null = null;
  const userStr = localStorage.getItem("user");
  if (userStr) {
    try {
      const userObj = JSON.parse(userStr);
      ps = userObj.ps ?? localStorage.getItem("ps");
      Cuser = userObj.Cuser ?? localStorage.getItem("Cuser");
    } catch {
      ps = localStorage.getItem("ps");
      Cuser = localStorage.getItem("Cuser");
    }
  } else {
    ps = localStorage.getItem("ps");
    Cuser = localStorage.getItem("Cuser");
  }

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const userObj = JSON.parse(userStr);
        setChiraUser(userObj.name_user || "");
      } catch {
        setChiraUser("");
      }
    }
  }, []);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${apiIp}/invoices/UpdateCh/${id_fact}`,
        {
          return_chira: returnChira,
          comment_chira: commentChira,
          usr_receive_chira: Cuser,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (onClose) onClose();
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error("Error updating chira:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        maxWidth: 480,
        mx: "auto",
        p: 3,
        boxShadow: 2,
        borderRadius: 2,
      }}
    >
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
        Return Chira
      </Typography>
      <TextField
        label="Return Chira Date"
        type="date"
        size="small"
        value={returnChira}
        onChange={(e) => setReturnChira(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ mb: 2, width: "100%" }}
      />
      <TextField
        label="Comment Chira"
        multiline
        minRows={3}
        value={commentChira}
        onChange={(e) => setCommentChira(e.target.value)}
        sx={{ mb: 2, width: "100%" }}
      />
      <TextField
        label="User Receive Chira"
        value={chiraUser}
        InputProps={{ readOnly: true }}
        sx={{ mb: 2, width: "100%" }}
      />
      <Button
        variant="contained"
        color="primary"
        sx={{ mt: 2, fontWeight: 600, width: "100%" }}
        disabled={loading}
        onClick={handleUpdate}
      >
        Update
      </Button>
    </Box>
  );
};

export default ChiraReturnPage;
