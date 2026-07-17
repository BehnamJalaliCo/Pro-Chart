import Header from './Header';
import Footer from './Footer';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-dark-950">
      <Header />
      <main className="flex-1 pt-16 lg:pt-32">
        {children}
      </main>
      <Footer />
    </div>
  );
}
