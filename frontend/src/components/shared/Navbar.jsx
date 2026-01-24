import React, { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { clearUser } from '@/redux/slice/user.slice'
import { 
  Navbar as ResizableNavbar, 
  NavBody, 
  NavItems,
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavbarButton
} from '@/components/ui/resizable-navbar'

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { isAuthenticated } = useSelector((state) => state.user)
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const navItems = [
    { name: 'Home', link: '/' },
    { name: 'Call an agent', link: '/call' },
    { name: 'Chat with an agent', link: '/chat' }
  ]

  const handleNavClick = () => {
    setIsOpen(false)
  }

  const handleLogout = () => {
    dispatch(clearUser())
    navigate('/login')
    setIsOpen(false)
  }

  return (
    <ResizableNavbar>
      {/* Desktop Navbar */}
      <NavBody>
        {/* Logo */}
        <a
          href="/"
          className="relative z-20 mr-4 flex items-center space-x-2 px-2 py-1 text-sm font-normal text-black"
        >
          <img
            src="/logo-white.png"
            alt="logo"
            width={100}
            height={100}
          />
        </a>

        {/* Nav Links */}
        <NavItems items={navItems} />

        {/* Buttons */}
        <div className="relative z-20 flex items-center space-x-2">
          {isAuthenticated ? (
            <NavbarButton onClick={handleLogout} variant="primary">
              Logout
            </NavbarButton>
          ) : (
            <>
              <NavbarButton href="/login" variant="secondary">
                Login
              </NavbarButton>
              <NavbarButton href="/register" variant="primary">
                Get started
              </NavbarButton>
            </>
          )}
        </div>
      </NavBody>

      {/* Mobile Navbar */}
      <MobileNav>
        <MobileNavHeader>
          {/* Logo */}
          <a
            href="/"
            className="relative z-20 flex items-center space-x-2 px-2 py-1 text-sm font-normal text-black"
          >
            <img
              src="/logo-white.png"
              alt="logo"
              width={40}
              height={40}
            />
            <span className="font-medium text-black dark:text-white">Clarity</span>
          </a>

          {/* Toggle Button */}
          <MobileNavToggle isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
        </MobileNavHeader>

        {/* Mobile Menu */}
        <MobileNavMenu isOpen={isOpen} onClose={() => setIsOpen(false)}>
          {navItems.map((item, idx) => (
            <a
              key={`mobile-link-${idx}`}
              href={item.link}
              onClick={handleNavClick}
              className="w-full text-neutral-600 dark:text-neutral-300"
            >
              {item.name}
            </a>
          ))}
          <div className="mt-4 flex w-full flex-col space-y-2">
            {isAuthenticated ? (
              <NavbarButton onClick={handleLogout} variant="primary" className="w-full">
                Logout
              </NavbarButton>
            ) : (
              <>
                <NavbarButton href="/login" variant="secondary" className="w-full">
                  Login
                </NavbarButton>
                <NavbarButton href="/register" variant="primary" className="w-full">
                  Get started
                </NavbarButton>
              </>
            )}
          </div>
        </MobileNavMenu>
      </MobileNav>
    </ResizableNavbar>
  )
}

export default Navbar