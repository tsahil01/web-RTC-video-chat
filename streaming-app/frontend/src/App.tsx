import { BrowserRouter, Route, Routes } from "react-router";
import Consumer from "./components/Consumer";
import Producer from "./components/Producer";

export default function App() {
  return <BrowserRouter>
    <Routes>
      <Route path="/producer" element={<Producer />} />
      <Route path="/consumer" element={<Consumer />} />
    </Routes>
  </BrowserRouter>;
}
