import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/dashboard/Login";
import DashboardLayout from "./pages/dashboard/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import ProductsAdmin from "./pages/dashboard/ProductsAdmin";
import OrdersBoard from "./pages/dashboard/OrdersBoard";
import Insights from "./pages/dashboard/Insights";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard/login" element={<Login />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<Overview />} />
        <Route path="products" element={<ProductsAdmin />} />
        <Route path="orders" element={<OrdersBoard />} />
        <Route path="insights" element={<Insights />} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
