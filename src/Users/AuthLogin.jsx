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
  const history = useNavigate();
  const [checked, setChecked] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const handleClickShowPassword = () => setShowPassword((show) => !show);
  const handleMouseDownPassword = (event) => event.preventDefault();

  async function SignIn(email, password) {
    try {
      const res = await axios.post(
        "http://102.213.182.8:9000/api/login",
        { email, password },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (res.data.token) {
        localStorage.setItem('token', res.data.token);



        // Option 1: Use localStorage (persists after refresh)
        localStorage.setItem('user', JSON.stringify({
          id: email,
          ps: res.data.user.ps,
          Cuser: res.data.user.id_user,
          roles: res.data.user.Action_user,
          name_user: res.data.user.name_user
        }));
        history("/home");

        // Option 2: Use React Router state (does NOT persist after refresh)
        // history("/home", { state: { id: email, ps: res.data.user.ps, Cuser: res.data.user.id_user } });

      } else {
        setis_not_found("Login failed: Token is missing!");
      }
    } catch (e) {

      console.log(e)
      setis_not_found("Login or Password is wrong. Please try again!");
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
                  <Formik
                    onSubmit={(values, actions) => {
                      setTimeout(() => {
                        SignIn(values.email, values.password);
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
                              disabled={isSubmitting}
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
