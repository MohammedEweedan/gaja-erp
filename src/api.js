// src/api.js
import axios from "axios";

const api = axios.create({
  //baseURL: "/api",  
  baseURL: "https://system.gaja.ly/api",    
});

export default api;
