import Navbar from "./global/Navbar"
import Hero from "./Hero"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <Hero />
    </div>
  )
}
