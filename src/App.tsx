import './App.css';
import Home from './Profile/Home';
import AuthLogin from './Users/AuthLogin';
import { BrowserRouter, Route, Routes } from "react-router-dom";
 

function App() {

 


  return (
 

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AuthLogin />} />
          <Route path="/*" element={<Home />} />
       
        </Routes>
      </BrowserRouter>
 


  );
}

export default App;
