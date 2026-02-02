// App.tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CustomThemeProvider } from "./theme/ThemeProvider";
import { LanguageProvider } from "./contexts/LanguageContext";
import { I18nextProvider } from "react-i18next";
import { AuthProvider } from "./contexts/AuthContext";
import i18n from "./i18n/i18n";
import FontStyles from "./theme/fonts";
import Home from "./Profile/Home";
import AuthLogin from "./Users/AuthLogin";
import "./App.css";

// ⬇️ add
import { CacheProvider } from "@emotion/react";
import createEmotionCacheLTR from "./theme/ltrEmotionCache";
import { GlobalStyles } from "@mui/material";
import React from "react";

const cache = createEmotionCacheLTR();

function App() {
  // Keep the <html> element clamped to LTR even if i18n/libraries flip it
  React.useEffect(() => {
    const clamp = () => document.documentElement.setAttribute("dir", "ltr");
    clamp();
    i18n.on("languageChanged", clamp);
    return () => {
      i18n.off("languageChanged", clamp);
    };
  }, []);

  return (
    <CacheProvider value={cache}>
      <I18nextProvider i18n={i18n}>
        <LanguageProvider>
          <CustomThemeProvider>
            {/* make sure this theme uses direction: 'ltr' (see step 3) */}
            <AuthProvider>
              {/* Hard LTR neutralizer for any nested [dir="rtl"] */}
              <GlobalStyles
                styles={{
                  "html, body, #root": { direction: "ltr" },
                  '[dir="rtl"]': { direction: "ltr !important" },
                }}
              />
              <FontStyles />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<AuthLogin />} />
                  <Route path="/*" element={<Home />} />
                </Routes>
              </BrowserRouter>
            </AuthProvider>
          </CustomThemeProvider>
        </LanguageProvider>
      </I18nextProvider>
    </CacheProvider>
  );
}

export default App;
