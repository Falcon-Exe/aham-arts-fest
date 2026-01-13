import { lazy, Suspense } from "react";

// Lazy loaded components
const Header = lazy(() => import("../components/Header"));
const Gallery = lazy(() => import("../components/Gallery"));

function Home() {
  console.log("HOME RENDERED");

  return (
    <div className="container">
      <Suspense fallback={<p>Loading header...</p>}>
        <Header />
      </Suspense>

      <section className="section">
        <Suspense fallback={<p>Loading gallery...</p>}>

  <Gallery />
        </Suspense>
      </section>
    </div>
  );
}

export default Home;
