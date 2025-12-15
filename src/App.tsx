import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Post from "./pages/Post";
import Stats from "./pages/Stats";
import Layout from "./components/Layout";
import { usePageTracking } from "./hooks/usePageTracking";

function App() {
  // Track page views and active sessions
  usePageTracking();

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/:slug" element={<Post />} />
      </Routes>
    </Layout>
  );
}

export default App;

