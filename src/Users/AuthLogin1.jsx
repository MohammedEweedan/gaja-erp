import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import 'bootstrap/dist/css/bootstrap.min.css';
import axios from "axios";
import { useState } from "react";
import * as Yup from 'yup';
import { Formik } from 'formik';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import AnimateButton from '../ui-component/extended/AnimateButton';
import Button from '@mui/material/Button';
import { useNavigate } from "react-router-dom";
import Logo from '../ui-component/Logo';

function AuthLogin({ ...others }) {
  const [is_not_found, setis_not_found] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const history = useNavigate();
  const [checked, setChecked] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loginStep, setLoginStep] = useState(1); // 1 = credentials, 2 = verification
  const [verificationCode, setVerificationCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [userData, setUserData] = useState(null);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const handleClickShowPassword = () => setShowPassword((show) => !show);
  const handleMouseDownPassword = (event) => event.preventDefault();

  // Generate a random 6-digit code
  const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Send WhatsApp message with verification code
  const sendWhatsAppVerification = async (phoneNumber, code, setIsSendingCode) => {
    // First validate the phone number (should be in E.164 format without '+' or spaces)
    const cleanedPhone = phoneNumber.replace(/\D/g, ''); // Remove all non-digit characters

    if (!/^\d{11,15}$/.test(cleanedPhone)) {
      console.error("Invalid phone number format. Must be 11-15 digits in E.164 format.");
      throw new Error("Invalid phone number format");
    }

    try {
      setIsSendingCode(true);
 
      const token = process.env.REACT_APP_WHATSAPP_TOKEN;
      if (!token) throw new Error('WhatsApp API token is not set in environment variables.');
 
      const response = await axios.post(
        'https://graph.facebook.com/v22.0/657226780814634/messages',
        {
          messaging_product: "whatsapp",
          to: cleanedPhone,
          type: "template",
          template: {
            name: "verification_code",
            language: { code: "en_US" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: code }
                ]
              },
              {
                type: "button",
                sub_type: "url",
                index: 0,
                parameters: [
                  { type: "text", text: "verify-link" }
                ]
              }
            ]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log("WhatsApp API response:", response.data);
    } catch (error) {
      if (error.response) {
        console.error("WhatsApp API error:", JSON.stringify(error.response.data, null, 2));
      } else {
        console.error("Error sending WhatsApp message:", error.message);
      }
      throw error;
    } finally {
      setIsSendingCode(false);
    }
  };

  async function verifyCredentials(email, password) {
    try {
      const res = await axios.post("http://102.213.182.8:9000/api/login", { email, password });

      if (res.data.token) {
        // Store user data temporarily (don't login yet)
        setUserData({
          token: res.data.token,
          email,
          user: res.data.user
        });

        // Generate and send verification code
        const code = generateVerificationCode();
        setGeneratedCode(code);

        // Send WhatsApp message (assuming phone number is available in user data)
        await sendWhatsAppVerification(res.data.user.name, code, setIsSendingCode);

        // Move to verification step
        setLoginStep(2);
      } else {
        setis_not_found("Login failed: Token is missing!");
      }
    } catch (e) {
      console.log(e);
      // Store only a string, not the Error object, to avoid React rendering issues
      const msg = e && e.response && e.response.data && (e.response.data.message || e.response.data.error)
        ? e.response.data.message || e.response.data.error
        : (e && e.message) ? e.message : "Login or Password is wrong. Please try again!";
      setis_not_found(msg);
    }
  }

  function handleVerification() {
    if (verificationCode === generatedCode) {
      // Code matches - complete login
      localStorage.setItem('token', userData.token);
      history("/home", {
        state: {
          id: userData.email,
          ps: userData.user.ps,
          Cuser: userData.user.id_user
        }
      });
    } else {
      setVerificationError("Invalid verification code. Please try again.");
    }
  }

  return (
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-xl-10 col-lg-10 col-md-9">
          <div className="shadow-sm p-3 mb-5 bg-light rounded my-5">
            <div className="row">
              {/* Left Info Panel */}
              <div className="col-lg-6 d-none d-lg-block">
                <div className="container">
                  <div className="row p-2">
                    <div className="p-3 mb-5 bg-light rounded my-5">
                      <div style={{ textAlign: 'justify' }}>
                        <h2>GJ ERP System</h2>
                        <h4>About GJ</h4>
                        <p>
                          Gaja Group Company (GJ) — Gaja Jewelry / مجوهرات قاجة is a Libyan luxury jewelry brand
                          specializing in the design, sale, and crafting of gold and diamond jewelry. Known for its
                          elegant, high-quality pieces, Gaja Jewelry blends traditional aesthetics with modern design,
                          offering collections that reflect both cultural heritage and refined craftsmanship.
                        </p>
                        <a href="https://gaja.ly/">Explore GAJA →</a>
                        <h4 className="mt-4">About System</h4>
                        <p>
                          ERP consists of several modules, including Financial Accounting (FI), Controlling (CO),
                          Asset Accounting (AA), Sales & Distribution (SD), Material Management (MM), etc.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Login Form */}
              <div className="col-lg-6">
                <div className="p-5">
                  <div className="text-center">
                    <Logo />
                    <h1 className="h4 text-gray-900 mb-4">Welcome Back!</h1>
                  </div>

                  {loginStep === 1 ? (
                    <Formik
                      onSubmit={(values, actions) => {
                        setTimeout(() => {
                          verifyCredentials(values.email, values.password);
                          actions.setSubmitting(false);
                        }, 500);
                      }}
                      initialValues={{
                        email: '',
                        password: '',
                      }}
                      validationSchema={Yup.object().shape({
                        email: Yup.string().email('Must be a valid email').max(255).required('Email is required'),
                        password: Yup.string().max(255).required('Password is required')
                      })}
                    >
                      {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values }) => (
                        <form noValidate onSubmit={handleSubmit} {...others}>
                          <FormControl fullWidth error={Boolean(touched.email && errors.email)} sx={{ mb: 2 }}>
                            <InputLabel htmlFor="outlined-adornment-email-login">Email Address / Username</InputLabel>
                            <OutlinedInput
                              id="outlined-adornment-email-login"
                              type="email"
                              value={values.email}
                              name="email"
                              onBlur={handleBlur}
                              onChange={handleChange}
                              label="Email Address / Username"
                            />
                            {touched.email && errors.email && (
                              <FormHelperText error>
                                {errors.email}
                              </FormHelperText>
                            )}
                          </FormControl>

                          <FormControl fullWidth error={Boolean(touched.password && errors.password)}>
                            <InputLabel htmlFor="outlined-adornment-password-login">Password</InputLabel>
                            <OutlinedInput
                              id="outlined-adornment-password-login"
                              type={showPassword ? 'text' : 'password'}
                              value={values.password}
                              name="password"
                              onBlur={handleBlur}
                              onChange={handleChange}
                              endAdornment={
                                <InputAdornment position="end">
                                  <IconButton
                                    aria-label="toggle password visibility"
                                    onClick={handleClickShowPassword}
                                    onMouseDown={handleMouseDownPassword}
                                    edge="end"
                                  >
                                    {showPassword ? <Visibility /> : <VisibilityOff />}
                                  </IconButton>
                                </InputAdornment>
                              }
                              label="Password"
                            />
                            {touched.password && errors.password && (
                              <FormHelperText error>
                                {errors.password}
                              </FormHelperText>
                            )}
                          </FormControl>

                          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mt: 1 }}>
                            <FormControlLabel
                              control={
                                <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} color="primary" />
                              }
                              label="Remember me"
                            />
                            <Typography variant="subtitle1" color="secondary" sx={{ textDecoration: 'none', cursor: 'pointer' }}>
                              Forgot Password?
                            </Typography>
                          </Stack>

                          {errors.submit && (
                            <Box sx={{ mt: 3 }}>
                              <FormHelperText error>{errors.submit}</FormHelperText>
                            </Box>
                          )}

                          <Box sx={{ mt: 2 }}>
                            <AnimateButton>
                              <Button
                                disableElevation
                                disabled={isSubmitting || isSendingCode}
                                fullWidth
                                size="large"
                                type="submit"
                                variant="contained"
                                color="secondary"
                              >
                                {isSubmitting ? 'Signing in...' : 'Sign in'}
                              </Button>
                            </AnimateButton>
                          </Box>
                        </form>
                      )}
                    </Formik>
                  ) : (
                    <div>
                      <Typography variant="h6" gutterBottom>
                        Verify Your Identity
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        We've sent a 6-digit verification code to your WhatsApp number. Please enter it below.
                      </Typography>

                      <FormControl fullWidth sx={{ mt: 3 }}>
                        <InputLabel htmlFor="verification-code">Verification Code</InputLabel>
                        <OutlinedInput
                          id="verification-code"
                          type="text"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          label="Verification Code"
                          inputProps={{ maxLength: 6 }}
                        />
                      </FormControl>

                      {verificationError && (
                        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                          {verificationError}
                        </Typography>
                      )}

                      <Box sx={{ mt: 2 }}>
                        <Button
                          fullWidth
                          variant="contained"
                          color="primary"
                          onClick={handleVerification}
                        >
                          Verify
                        </Button>
                      </Box>

                      <Box sx={{ mt: 2 }}>
                        <Button
                          fullWidth
                          variant="outlined"
                          color="secondary"
                          onClick={() => setLoginStep(1)}
                        >
                          Back to Login
                        </Button>
                      </Box>
                    </div>
                  )}

                  <hr />
                  <small className="form-text text-muted-warning fst-italic text-danger">
                    {is_not_found}
                  </small>
                  <br />
                  <small className="form-text text-muted-warning fst-italic">
                    We'll never share your email and password with anyone else.
                  </small>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="row justify-content-center text-center">
            <small className="text-secondary">This Portal was created by IT Dept.</small>
            <small className="text-secondary">
              ©2025 Copyright: <a className="text-info" href="https://gaja.ly/">gaja.ly</a>
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthLogin;