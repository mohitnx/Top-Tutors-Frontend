interface HeaderProps {
  isMenuOpen: boolean
  setIsMenuOpen: (open: boolean) => void
}

const Header = ({ isMenuOpen, setIsMenuOpen }: HeaderProps) => {
  const navLinks = ['Features', 'Courses', 'Tutors', 'Pricing']

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent flex items-center justify-center shadow-lg shadow-primary-500/25 group-hover:shadow-primary-500/40 transition-shadow">
              <span className="text-white font-display font-bold text-xl">T</span>
            </div>
            <span className="font-display font-semibold text-xl hidden sm:block">
              Top<span className="text-primary-400">Tutor</span>
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                className="text-zinc-400 hover:text-white transition-colors duration-200 font-medium"
              >
                {link}
              </a>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-4">
            <button className="px-4 py-2 text-zinc-300 hover:text-white transition-colors">
              Sign In
            </button>
            <button className="btn-primary">
              Get Started
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 text-zinc-400 hover:text-white"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-800">
          <nav className="px-4 py-4 space-y-2">
            {navLinks.map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                className="block py-3 px-4 text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-colors"
              >
                {link}
              </a>
            ))}
            <div className="pt-4 flex flex-col gap-3">
              <button className="w-full py-3 text-zinc-300 hover:text-white border border-zinc-700 rounded-xl">
                Sign In
              </button>
              <button className="btn-primary w-full text-center">
                Get Started
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

export default Header

