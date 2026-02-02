// AuthLogin.tsx
import InputLabel from "@mui/material/InputLabel";
import OutlinedInput from "@mui/material/OutlinedInput";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "../api";
import { useState } from "react";
import * as Yup from "yup";
import { Formik } from "formik";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

// Animations
import { keyframes } from "@mui/system";

// Toggles
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import LanguageSwitcher from "../components/LanguageSwitcher";

// Use your theme context (same one you used in Header)
import { useThemeContext } from "../theme/ThemeProvider";

function AuthLogin({ ...others }) {
  const { t } = useTranslation();
  const { mode, toggleColorMode } = useThemeContext(); // <- leverages your global theme provider
  const [is_not_found, setis_not_found] = useState("");
  const history = useNavigate();
  const [checked, setChecked] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Success cinematic state
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string>("");

  const handleClickShowPassword = () => setShowPassword((show) => !show);
  const handleMouseDownPassword = (event: React.MouseEvent) =>
    event.preventDefault();

  // Cinematic keyframes (longer & staggered)
  const overlayFadeIn = keyframes`
    from { opacity: 0 }
    to { opacity: 1 }
  `;
  const blockRise = keyframes`
    0% { transform: translateY(16px); opacity: 0 }
    50% { transform: translateY(0); opacity: .9 }
    100% { transform: translateY(0); opacity: 1 }
  `;
  const logoReveal = keyframes`
    0% { transform: scale(.9); opacity: 0 }
    60% { transform: scale(1.03); opacity: 1 }
    100% { transform: scale(1); opacity: 1 }
  `;
  
  const textFade = keyframes`
    from { opacity: 0; transform: translateY(6px) }
    to { opacity: 1; transform: translateY(0) }
  `;

  // Dynamic logo source (dark/light)
  const logoSrc = mode === "dark" ? "/Gaja White.png" : "/Gaja White.png";

  async function SignIn(email: string, password: string) {
    try {
      const res = await axios.post(
        "/login",
        { email, password },
        { headers: { "Content-Type": "application/json" } }
      );

      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem(
          "user",
          JSON.stringify({
            id: email,
            ps: res.data.user.ps,
            Cuser: res.data.user.id_user,
            roles: res.data.user.Action_user,
            name_user: res.data.user.name_user,
            Prvilege: res.data.user.Roles,
          })
        );

        const name = res?.data?.user?.name_user || email;
        setWelcomeName(name);
        setLoginSuccess(true);

        // Longer & more gradual (about 2.6s total)
        setTimeout(() => {
          history("/home");
        }, 2600);
      } else {
        setis_not_found(t("login.tokenMissing"));
      }
    } catch (e) {
      console.log("Login error:", e);
      setis_not_found(t("login.loginFailed"));
    }
  }

  return (
    <>
      {/* Fullscreen cinematic overlay */}
      {loginSuccess && (
        <Box
          aria-live="polite"
          aria-label="Login Success"
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(0,0,0,0.78)",
            animation: `${overlayFadeIn} 320ms ease-out`,
            backdropFilter: "blur(2px)",
          }}
        >
          <Box
            sx={{
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              p: 4,
              animation: `${blockRise} 600ms ease-out 120ms both`,
            }}
          >
            <Box
              sx={{
                transformOrigin: "center",
                animation: `${logoReveal} 720ms ease-out 80ms both`,
                width: { xs: 220, sm: 320, md: 380 },
              }}
            >
              <img
                src={logoSrc}
                alt="Logo"
                style={{ width: "100%", height: "auto" }}
              />
            </Box>

            <Typography
              variant="h3"
              sx={{
                mt: 3,
                fontWeight: 800,
                letterSpacing: 0.4,
                color: "rgba(255,255,255,0.8)",
                textShadow: "0 0 18px rgba(255,255,255,0.35)",
                animation: `${textFade} 420ms ease-out 500ms both`,
              }}
            >
              {t("login.welcomeUser", {
                defaultValue: "Welcome, {{name}}",
                name: welcomeName,
              })}
            </Typography>

            <Stack
              direction="row"
              spacing={1.25}
              alignItems="center"
              justifyContent="center"
              sx={{
                mt: 1.25,
                animation: `${textFade} 420ms ease-out 820ms both`,
              }}
            >
              <CircularProgress
                size={16}
                thickness={5}
                sx={{ color: "#b7a27d" }}
              />
              <Typography
                variant="body2"
                sx={{ color: "rgba(255,255,255,0.8)" }}
              >
                {t("login.redirecting") || "Redirecting…"}
              </Typography>
            </Stack>
          </Box>
        </Box>
      )}

      {/* Login Content (no header) */}
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          bgcolor: (t) => t.palette.background.default,
          pt: 2,
          // lock interactions during cinematic
          pointerEvents: loginSuccess ? "none" : "auto",
          userSelect: loginSuccess ? "none" : "auto",
          filter: loginSuccess ? "blur(0.5px)" : "none",
          transition: "filter 180ms ease",
        }}
      >
        <Container maxWidth="sm">
          <Paper
            elevation={8}
            sx={{
              position: "relative",
              p: { xs: 3, sm: 5 },
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
              boxShadow: (t) => t.shadows[8],
              bgcolor: (t) => t.palette.background.paper,
            }}
          >
            {/* Top-right action bar: theme + language */}
            <Stack
              direction="row"
              spacing={1}
              sx={{ position: "absolute", top: 10, right: 10 }}
              alignItems="center"
            >
              <Tooltip
                title={
                  mode === "dark"
                    ? t("header.lightMode") || "Light mode"
                    : t("header.darkMode") || "Dark mode"
                }
              >
                <IconButton
                  size="small"
                  onClick={toggleColorMode}
                  sx={{
                    color: (t) => t.palette.text.primary,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  {mode === "dark" ? (
                    <Brightness7Icon fontSize="small" />
                  ) : (
                    <Brightness4Icon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>

              {/* Your existing language switcher */}
              <LanguageSwitcher />
            </Stack>

            {/* Header */}
            <Stack
              spacing={1}
              alignItems="center"
              textAlign="center"
              sx={{ mb: 3 }}
            >
              <Typography variant="h5" fontWeight={700} sx={{ mt: 1 }}>
                {t("login.welcome")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("login.signInToContinue")}
              </Typography>
            </Stack>

            {/* Form */}
            <Formik
              onSubmit={(values, actions) => {
                if (loginSuccess) return;
                setTimeout(() => {
                  SignIn(values.email, values.password);
                  actions.setSubmitting(false);
                }, 150);
              }}
              initialValues={{ email: "", password: "" }}
              validationSchema={Yup.object().shape({
                email: Yup.string()
                  .email(t("login.email") + " must be valid")
                  .max(255)
                  .required(t("login.email") + " is required"),
                password: Yup.string()
                  .max(255)
                  .required(t("login.password") + " is required"),
              })}
            >
              {({
                errors,
                handleBlur,
                handleChange,
                handleSubmit,
                isSubmitting,
                touched,
                values,
              }) => (
                <Box
                  component="form"
                  noValidate
                  onSubmit={handleSubmit}
                  {...others}
                >
                  <Stack
                    spacing={2.5}
                    sx={{
                      opacity: loginSuccess ? 0.45 : 1,
                      transition: "opacity 160ms",
                    }}
                  >
                    <FormControl
                      fullWidth
                      error={Boolean(touched.email && errors.email)}
                    >
                      <InputLabel htmlFor="outlined-adornment-email-login">
                        {t("login.email")}
                      </InputLabel>
                      <OutlinedInput
                        id="outlined-adornment-email-login"
                        type="email"
                        value={values.email}
                        name="email"
                        onBlur={handleBlur}
                        onChange={handleChange}
                        disabled={loginSuccess}
                        label={t("login.email")}
                        startAdornment={
                          <InputAdornment position="start">
                            <EmailOutlined fontSize="small" />
                          </InputAdornment>
                        }
                      />
                      {touched.email && errors.email && (
                        <FormHelperText error>{errors.email}</FormHelperText>
                      )}
                    </FormControl>

                    <FormControl
                      fullWidth
                      error={Boolean(touched.password && errors.password)}
                    >
                      <InputLabel htmlFor="outlined-adornment-password-login">
                        {t("login.password")}
                      </InputLabel>
                      <OutlinedInput
                        id="outlined-adornment-password-login"
                        type={showPassword ? "text" : "password"}
                        value={values.password}
                        name="password"
                        onBlur={handleBlur}
                        onChange={handleChange}
                        disabled={loginSuccess}
                        startAdornment={
                          <InputAdornment position="start">
                            <LockOutlined fontSize="small" />
                          </InputAdornment>
                        }
                        endAdornment={
                          <InputAdornment position="end">
                            <IconButton
                              aria-label={t("login.togglePassword")}
                              onClick={handleClickShowPassword}
                              onMouseDown={handleMouseDownPassword}
                              edge="end"
                              disabled={loginSuccess}
                            >
                              {showPassword ? (
                                <Visibility />
                              ) : (
                                <VisibilityOff />
                              )}
                            </IconButton>
                          </InputAdornment>
                        }
                        label={t("login.password")}
                      />
                      {touched.password && errors.password && (
                        <FormHelperText error>{errors.password}</FormHelperText>
                      )}
                    </FormControl>

                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={checked}
                            onChange={(e) => setChecked(e.target.checked)}
                            color="primary"
                            disabled={loginSuccess}
                          />
                        }
                        label={t("login.rememberMe")}
                      />
                      <Link
                        component="button"
                        type="button"
                        underline="hover"
                        sx={{ fontSize: 14 }}
                        onClick={() => console.log("Forgot Password clicked")}
                        // MUI Link doesn't support disabled; leave interactive
                      >
                        {t("login.forgotPassword")}
                      </Link>
                    </Stack>

                    <Button
                      disableElevation
                      disabled={isSubmitting || loginSuccess}
                      fullWidth
                      size="large"
                      type="submit"
                      variant="contained"
                      color="primary"
                    >
                      {isSubmitting ? t("login.signingIn") : t("login.signIn")}
                    </Button>
                  </Stack>
                </Box>
              )}
            </Formik>

            <Divider sx={{ my: 3 }} />

            {/* Helper text / notices */}
            <Stack spacing={1} textAlign="center">
              <Typography
                variant="body2"
                color="error.main"
                sx={{ minHeight: 20 }}
              >
                {is_not_found}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("login.privacyNotice")}
              </Typography>
            </Stack>
          </Paper>

          {/* Footer */}
          <Stack spacing={0.25} alignItems="center" sx={{ mt: 3 }}>
            <Typography variant="caption" color="text.secondary">
              {t("footer.createdBy")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("footer.copyright")}{" "}
              <Link href="https://gaja.ly/" target="_blank" rel="noopener">
                gaja.ly
              </Link>
            </Typography>
          </Stack>
        </Container>
      </Box>
    </>
  );
}

export default AuthLogin;
