"use client"

import { useEffect, useState } from "react"

function readInitialTheme() {
  if (typeof window === "undefined") {
    return false
  }

  const stored = localStorage.getItem("theme")
  if (stored) {
    return stored === "dark"
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(readInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("theme", dark ? "dark" : "light")
  }, [dark])

  return (
    <button
      onClick={() => setDark((prev) => !prev)}
      className="rounded-lg bg-gray-800 px-4 py-2 text-white transition dark:bg-white dark:text-black"
    >
      {dark ? "Light Mode" : "Dark Mode"}
    </button>
  )
}