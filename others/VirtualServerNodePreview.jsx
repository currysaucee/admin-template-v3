import React, { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DnsIcon from "@mui/icons-material/Dns";
import LanIcon from "@mui/icons-material/Lan";
import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";

const serverOptions = [
  "app01.company.local / 10.10.1.11",
  "app02.company.local / 10.10.1.12",
  "app03.company.local / 10.20.1.11",
  "app04.company.local / 10.20.1.12",
];

const emptyNode = {
  server: "",
  nodePort: "",
};

const newVirtualServer = (port = "") => ({
  id: crypto.randomUUID(),
  vsPort: port,
  idleTimeout: "300",
  xForwarded: "enabled",
  persistence: "source_addr",
  nodes: {
    uat: [{ ...emptyNode }],
    dce: [{ ...emptyNode }],
    dcw: [{ ...emptyNode }],
  },
});

export default function VirtualServerNodePreview() {
  const [environment, setEnvironment] = useState("PROD");
  const [virtualServers, setVirtualServers] = useState([
    newVirtualServer("443"),
  ]);

  const isProd = environment === "PROD";

  const updateVs = (vsId, field, value) => {
    setVirtualServers((prev) =>
      prev.map((vs) => (vs.id === vsId ? { ...vs, [field]: value } : vs))
    );
  };

  const updateNode = (vsId, dcKey, index, field, value) => {
    setVirtualServers((prev) =>
      prev.map((vs) => {
        if (vs.id !== vsId) return vs;

        const updatedNodes = [...vs.nodes[dcKey]];
        updatedNodes[index] = {
          ...updatedNodes[index],
          [field]: value,
        };

        return {
          ...vs,
          nodes: {
            ...vs.nodes,
            [dcKey]: updatedNodes,
          },
        };
      })
    );
  };

  const addNode = (vsId, dcKey) => {
    setVirtualServers((prev) =>
      prev.map((vs) =>
        vs.id === vsId
          ? {
              ...vs,
              nodes: {
                ...vs.nodes,
                [dcKey]: [...vs.nodes[dcKey], { ...emptyNode }],
              },
            }
          : vs
      )
    );
  };

  const removeNode = (vsId, dcKey, index) => {
    setVirtualServers((prev) =>
      prev.map((vs) => {
        if (vs.id !== vsId) return vs;

        return {
          ...vs,
          nodes: {
            ...vs.nodes,
            [dcKey]: vs.nodes[dcKey].filter((_, i) => i !== index),
          },
        };
      })
    );
  };

  const addVirtualServer = () => {
    setVirtualServers((prev) => [...prev, newVirtualServer()]);
  };

  const removeVirtualServer = (vsId) => {
    setVirtualServers((prev) => prev.filter((vs) => vs.id !== vsId));
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f6f8fb", p: 4 }}>
      <Box sx={{ maxWidth: 1180, mx: "auto" }}>
        <Typography variant="h4" fontWeight={800}>
          Virtual Server Node Details
        </Typography>

        <Typography sx={{ color: "text.secondary", mt: 0.5, mb: 3 }}>
          Create one or more virtual server ports in the same request.
        </Typography>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Environment</InputLabel>
                <Select
                  label="Environment"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                >
                  <MenuItem value="UAT">UAT</MenuItem>
                  <MenuItem value="PROD">PROD</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={8}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: isProd ? "#fff7ed" : "#eff6ff",
                  border: "1px solid",
                  borderColor: isProd ? "#fed7aa" : "#bfdbfe",
                }}
              >
                <Typography fontWeight={800}>
                  {isProd ? "PROD requires DCE and DCW nodes" : "UAT requires one node group"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  VS behaviour applies to the whole VS port. Node port belongs to each selected node.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        <Stack spacing={3}>
          {virtualServers.map((vs, vsIndex) => (
            <Card key={vs.id} variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 2 }}
                >
                  <Stack direction="row" spacing={1.3} alignItems="center">
                    <SettingsEthernetIcon color="primary" />
                    <Box>
                      <Typography variant="h6" fontWeight={800}>
                        Virtual Server {vs.vsPort || vsIndex + 1}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Configure VS-level behaviour and backend node members.
                      </Typography>
                    </Box>
                  </Stack>

                  <IconButton
                    disabled={virtualServers.length === 1}
                    onClick={() => removeVirtualServer(vs.id)}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Virtual Server Port"
                      value={vs.vsPort}
                      onChange={(e) => updateVs(vs.id, "vsPort", e.target.value)}
                      placeholder="443"
                    />
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth>
                      <InputLabel>Idle Timeout</InputLabel>
                      <Select
                        label="Idle Timeout"
                        value={vs.idleTimeout}
                        onChange={(e) =>
                          updateVs(vs.id, "idleTimeout", e.target.value)
                        }
                      >
                        <MenuItem value="300">300 sec</MenuItem>
                        <MenuItem value="600">600 sec</MenuItem>
                        <MenuItem value="1800">1800 sec</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth>
                      <InputLabel>X-Forwarded</InputLabel>
                      <Select
                        label="X-Forwarded"
                        value={vs.xForwarded}
                        onChange={(e) =>
                          updateVs(vs.id, "xForwarded", e.target.value)
                        }
                      >
                        <MenuItem value="enabled">Enabled</MenuItem>
                        <MenuItem value="disabled">Disabled</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth>
                      <InputLabel>Persistence</InputLabel>
                      <Select
                        label="Persistence"
                        value={vs.persistence}
                        onChange={(e) =>
                          updateVs(vs.id, "persistence", e.target.value)
                        }
                      >
                        <MenuItem value="none">None</MenuItem>
                        <MenuItem value="source_addr">Source Address</MenuItem>
                        <MenuItem value="cookie">Cookie</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                {environment === "UAT" ? (
                  <NodeGroupCard
                    title="UAT Node Members"
                    tag="UAT"
                    nodes={vs.nodes.uat}
                    onAdd={() => addNode(vs.id, "uat")}
                    onRemove={(index) => removeNode(vs.id, "uat", index)}
                    onChange={(index, field, value) =>
                      updateNode(vs.id, "uat", index, field, value)
                    }
                  />
                ) : (
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <NodeGroupCard
                        title="DCE Node Members"
                        tag="DCE"
                        nodes={vs.nodes.dce}
                        onAdd={() => addNode(vs.id, "dce")}
                        onRemove={(index) => removeNode(vs.id, "dce", index)}
                        onChange={(index, field, value) =>
                          updateNode(vs.id, "dce", index, field, value)
                        }
                      />
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <NodeGroupCard
                        title="DCW Node Members"
                        tag="DCW"
                        nodes={vs.nodes.dcw}
                        onAdd={() => addNode(vs.id, "dcw")}
                        onRemove={(index) => removeNode(vs.id, "dcw", index)}
                        onChange={(index, field, value) =>
                          updateNode(vs.id, "dcw", index, field, value)
                        }
                      />
                    </Grid>
                  </Grid>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>

        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addVirtualServer}
          sx={{ mt: 3, textTransform: "none", borderRadius: 2 }}
        >
          Add Virtual Server Port
        </Button>

        <Box
          sx={{
            mt: 4,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Button variant="outlined" sx={{ textTransform: "none", borderRadius: 2 }}>
            Previous
          </Button>

          <Button variant="contained" sx={{ textTransform: "none", px: 5, borderRadius: 2 }}>
            Next
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

function NodeGroupCard({ title, tag, nodes, onAdd, onRemove, onChange }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2.5,
        bgcolor: "#fbfcfe",
        height: "100%",
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1} alignItems="center">
          <LanIcon color="primary" />
          <Typography fontWeight={800}>{title}</Typography>
          <Chip label={tag} size="small" color="primary" variant="outlined" />
        </Stack>

        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onAdd}
          sx={{ textTransform: "none" }}
        >
          Add Node
        </Button>
      </Stack>

      <Stack spacing={1.5} sx={{ mt: 2 }}>
        {nodes.map((node, index) => (
          <Paper key={index} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <DnsIcon fontSize="small" color="action" />
              <Typography fontWeight={700}>Node {index + 1}</Typography>

              <Box sx={{ flex: 1 }} />

              <IconButton
                size="small"
                disabled={nodes.length === 1}
                onClick={() => onRemove(index)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>

            <Grid container spacing={1.5}>
              <Grid item xs={12} md={8}>
                <FormControl fullWidth size="small">
                  <InputLabel>Server IP and Hostname</InputLabel>
                  <Select
                    label="Server IP and Hostname"
                    value={node.server}
                    onChange={(e) => onChange(index, "server", e.target.value)}
                  >
                    {serverOptions.map((server) => (
                      <MenuItem key={server} value={server}>
                        {server}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Node Port"
                  value={node.nodePort}
                  onChange={(e) => onChange(index, "nodePort", e.target.value)}
                  placeholder="8443"
                />
              </Grid>
            </Grid>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}